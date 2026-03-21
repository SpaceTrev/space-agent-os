// ============================================================
// Agent OS — Mistral AI Provider (OpenAI-compatible API)
// ============================================================

import OpenAI from 'openai'
import type {
  ModelCallOptions,
  ModelCallResult,
  ModelMessage,
  ModelTool,
} from '@/lib/types'

// ============================================================
// Convert our messages to OpenAI-compatible format
// ============================================================

function toOpenAIMessages(
  messages: ModelMessage[],
  system?: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = []

  const systemFromMessages = messages
    .filter((m) => m.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n\n')

  const fullSystem = [system, systemFromMessages].filter(Boolean).join('\n\n')
  if (fullSystem) {
    result.push({ role: 'system', content: fullSystem })
  }

  for (const m of messages.filter((m) => m.role !== 'system')) {
    if (m.role === 'user') {
      result.push({
        role: 'user',
        content: typeof m.content === 'string'
          ? m.content
          : m.content.map((b) => ({
              type: 'text' as const,
              text: b.type === 'text' ? (b.text ?? '') : '',
            })),
      })
    } else if (m.role === 'assistant') {
      result.push({
        role: 'assistant',
        content: typeof m.content === 'string' ? m.content : null,
      })
    } else if (m.role === 'tool') {
      result.push({
        role: 'tool',
        content: typeof m.content === 'string' ? m.content : '',
        tool_call_id: m.tool_call_id ?? '',
      })
    }
  }

  return result
}

// ============================================================
// Convert our tools to OpenAI format
// ============================================================

function toOpenAITools(tools: ModelTool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

// ============================================================
// Main callMistralModel function
// ============================================================

export async function callMistralModel(options: ModelCallOptions): Promise<ModelCallResult> {
  const apiKey = options.api_key ?? process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error('Mistral API key is required. Set MISTRAL_API_KEY or pass api_key.')
  }

  const client = new OpenAI({
    apiKey,
    baseURL: options.base_url ?? 'https://api.mistral.ai/v1',
  })

  const openaiMessages = toOpenAIMessages(options.messages, options.system)
  const tools = options.tools ? toOpenAITools(options.tools) : undefined

  const response = await client.chat.completions.create({
    model: options.model,
    messages: openaiMessages,
    max_tokens: options.max_tokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
  })

  const choice = response.choices[0]
  const message = choice.message

  const toolCalls: ModelCallResult['tool_calls'] = message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: (() => {
      try {
        return JSON.parse(tc.function.arguments) as Record<string, unknown>
      } catch {
        return { _raw: tc.function.arguments }
      }
    })(),
  }))

  let finishReason: ModelCallResult['finish_reason'] = 'stop'
  if (choice.finish_reason === 'tool_calls') finishReason = 'tool_use'
  else if (choice.finish_reason === 'length') finishReason = 'max_tokens'

  return {
    content: message.content ?? '',
    tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    tokens_input: response.usage?.prompt_tokens ?? 0,
    tokens_output: response.usage?.completion_tokens ?? 0,
    model: response.model,
    provider: 'mistral',
    finish_reason: finishReason,
    raw: response,
  }
}
