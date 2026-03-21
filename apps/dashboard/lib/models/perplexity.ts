// ============================================================
// Agent OS — Perplexity Provider (OpenAI-compatible API)
// ============================================================

import OpenAI from 'openai'
import type {
  ModelCallOptions,
  ModelCallResult,
  ModelMessage,
} from '@/lib/types'

// ============================================================
// Convert our messages to OpenAI-compatible format
// Note: Perplexity does NOT support tool calls or vision
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
    const textContent = typeof m.content === 'string'
      ? m.content
      : m.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('')

    if (m.role === 'user') {
      result.push({ role: 'user', content: textContent })
    } else if (m.role === 'assistant') {
      result.push({ role: 'assistant', content: textContent })
    }
    // Perplexity doesn't support tool role — skip
  }

  return result
}

// ============================================================
// Main callPerplexityModel function
// ============================================================

export async function callPerplexityModel(
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const apiKey = options.api_key ?? process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('Perplexity API key is required. Set PERPLEXITY_API_KEY or pass api_key.')
  }

  // Perplexity is OpenAI-compatible
  const client = new OpenAI({
    apiKey,
    baseURL: options.base_url ?? 'https://api.perplexity.ai',
  })

  const openaiMessages = toOpenAIMessages(options.messages, options.system)

  // Perplexity does not support function calling — warn if tools passed
  if (options.tools && options.tools.length > 0) {
    console.warn('[perplexity] Tool calls are not supported by Perplexity — ignoring tools.')
  }

  const response = await client.chat.completions.create({
    model: options.model,
    messages: openaiMessages,
    max_tokens: options.max_tokens ?? 4096,
    temperature: options.temperature ?? 0.7,
  })

  const choice = response.choices[0]

  let finishReason: ModelCallResult['finish_reason'] = 'stop'
  if (choice.finish_reason === 'length') finishReason = 'max_tokens'

  // Perplexity includes search citations in the response
  const rawResponse = response as typeof response & {
    citations?: string[]
    search_results?: Array<{ title: string; url: string; date?: string; snippet?: string }>
  }

  let content = choice.message.content ?? ''

  // Append citations if present
  if (rawResponse.citations && rawResponse.citations.length > 0) {
    content += '\n\n**Sources:**\n'
    rawResponse.citations.forEach((url, idx) => {
      content += `[${idx + 1}] ${url}\n`
    })
  }

  return {
    content,
    tool_calls: undefined,
    tokens_input: response.usage?.prompt_tokens ?? 0,
    tokens_output: response.usage?.completion_tokens ?? 0,
    model: response.model,
    provider: 'perplexity',
    finish_reason: finishReason,
    raw: response,
  }
}
