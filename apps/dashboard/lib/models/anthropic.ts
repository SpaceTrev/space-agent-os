// ============================================================
// Agent OS — Anthropic Provider
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type {
  ModelCallOptions,
  ModelCallResult,
  ModelMessage,
  ModelTool,
} from '@/lib/types'

// ============================================================
// Convert our generic message format to Anthropic format
// ============================================================

function toAnthropicMessages(
  messages: ModelMessage[]
): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.role !== 'system') // system handled separately
    .map((m): Anthropic.MessageParam => {
      if (typeof m.content === 'string') {
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }
      }

      // Array content
      const contentBlocks: any[] = m.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text ?? '' }
        }
        if (block.type === 'image_url' && block.image_url) {
          // Convert to Anthropic base64 image format
          const url = block.image_url.url
          if (url.startsWith('data:')) {
            const [header, data] = url.split(',')
            const mediaType = header.split(':')[1].split(';')[0] as
              | 'image/jpeg'
              | 'image/png'
              | 'image/gif'
              | 'image/webp'
            return {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data },
            }
          }
          return {
            type: 'image',
            source: { type: 'url', url },
          }
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id ?? '',
            name: block.name ?? '',
            input: block.input ?? {},
          }
        }
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: m.tool_call_id ?? '',
            content: typeof block.content === 'string' ? block.content : '',
          }
        }
        return { type: 'text', text: '' }
      })

      return {
        role: m.role as 'user' | 'assistant',
        content: contentBlocks,
      }
    })
}

// ============================================================
// Convert our generic tools to Anthropic tool format
// ============================================================

function toAnthropicTools(tools: ModelTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }))
}

// ============================================================
// Extract system prompt from messages
// ============================================================

function extractSystemPrompt(messages: ModelMessage[], explicitSystem?: string): string {
  const systemMessages = messages
    .filter((m) => m.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n\n')

  if (explicitSystem && systemMessages) {
    return `${explicitSystem}\n\n${systemMessages}`
  }
  return explicitSystem ?? systemMessages
}

// ============================================================
// Main callAnthropicModel function
// ============================================================

export async function callAnthropicModel(
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const apiKey = options.api_key ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY or pass api_key.')
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = extractSystemPrompt(options.messages, options.system)
  const anthropicMessages = toAnthropicMessages(options.messages)
  const tools = options.tools ? toAnthropicTools(options.tools) : undefined

  const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: options.model,
    max_tokens: options.max_tokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    messages: anthropicMessages,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    ...(tools && tools.length > 0 ? { tools } : {}),
  }

  const response = await client.messages.create(requestParams)

  // Extract text content
  let textContent = ''
  const toolCalls: ModelCallResult['tool_calls'] = []

  for (const block of response.content) {
    if (block.type === 'text') {
      textContent += block.text
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      })
    }
  }

  // Map Anthropic stop reason to our format
  let finishReason: ModelCallResult['finish_reason'] = 'stop'
  if (response.stop_reason === 'tool_use') {
    finishReason = 'tool_use'
  } else if (response.stop_reason === 'max_tokens') {
    finishReason = 'max_tokens'
  }

  return {
    content: textContent,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
    model: response.model,
    provider: 'anthropic',
    finish_reason: finishReason,
    raw: response,
  }
}
