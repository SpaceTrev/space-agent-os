// ============================================================
// Agent OS — Ollama Provider (Local models via HTTP API)
// ============================================================

import type {
  ModelCallOptions,
  ModelCallResult,
  ModelMessage,
  ModelTool,
} from '@/lib/types'

// ============================================================
// Ollama message/response types
// ============================================================

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  images?: string[]
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> }
  }>
}

interface OllamaChatRequest {
  model: string
  messages: OllamaMessage[]
  stream: boolean
  options?: {
    temperature?: number
    num_predict?: number
  }
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }>
}

interface OllamaChatResponse {
  model: string
  created_at: string
  message: OllamaMessage
  done: boolean
  done_reason?: string
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  eval_count?: number
}

// ============================================================
// Convert our messages to Ollama format
// ============================================================

function toOllamaMessages(
  messages: ModelMessage[],
  system?: string
): OllamaMessage[] {
  const result: OllamaMessage[] = []

  const systemFromMessages = messages
    .filter((m) => m.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n\n')

  const fullSystem = [system, systemFromMessages].filter(Boolean).join('\n\n')
  if (fullSystem) {
    result.push({ role: 'system', content: fullSystem })
  }

  for (const m of messages.filter((m) => m.role !== 'system')) {
    if (typeof m.content === 'string') {
      result.push({ role: m.role as OllamaMessage['role'], content: m.content })
      continue
    }

    let textContent = ''
    const images: string[] = []

    for (const block of m.content) {
      if (block.type === 'text') {
        textContent += block.text ?? ''
      } else if (block.type === 'image_url' && block.image_url) {
        const url = block.image_url.url
        if (url.startsWith('data:')) {
          // Extract base64 data
          const base64 = url.split(',')[1]
          if (base64) images.push(base64)
        }
      }
    }

    const msg: OllamaMessage = {
      role: m.role as OllamaMessage['role'],
      content: textContent,
    }
    if (images.length > 0) msg.images = images
    result.push(msg)
  }

  return result
}

// ============================================================
// Convert our tools to Ollama format
// ============================================================

function toOllamaTools(
  tools: ModelTool[]
): OllamaChatRequest['tools'] {
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
// Main callOllamaModel function
// ============================================================

export async function callOllamaModel(
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const baseUrl = options.base_url ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const endpoint = `${baseUrl}/api/chat`

  const ollamaMessages = toOllamaMessages(options.messages, options.system)
  const tools = options.tools && options.tools.length > 0
    ? toOllamaTools(options.tools)
    : undefined

  const requestBody: OllamaChatRequest = {
    model: options.model,
    messages: ollamaMessages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.max_tokens ?? 4096,
    },
    ...(tools ? { tools } : {}),
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  } catch (err) {
    throw new Error(
      `Failed to connect to Ollama at ${baseUrl}. Is Ollama running? Error: ${String(err)}`
    )
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama API error ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as OllamaChatResponse

  // Extract text content
  const content = data.message.content ?? ''

  // Extract tool calls if any
  const toolCalls: ModelCallResult['tool_calls'] = data.message.tool_calls?.map((tc, idx) => ({
    id: `ollama-tool-${idx}-${Date.now()}`,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }))

  // Token counts
  const inputTokens = data.prompt_eval_count ?? 0
  const outputTokens = data.eval_count ?? 0

  // Determine finish reason
  let finishReason: ModelCallResult['finish_reason'] = 'stop'
  if (data.done_reason === 'length') finishReason = 'max_tokens'
  else if (toolCalls && toolCalls.length > 0) finishReason = 'tool_use'

  return {
    content,
    tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    tokens_input: inputTokens,
    tokens_output: outputTokens,
    model: data.model,
    provider: 'ollama',
    finish_reason: finishReason,
    raw: data,
  }
}

// ============================================================
// Helper: List available local models
// ============================================================

export async function listOllamaModels(
  baseUrl = 'http://localhost:11434'
): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) return []
    const data = (await response.json()) as { models: Array<{ name: string }> }
    return data.models.map((m) => m.name)
  } catch {
    return []
  }
}

// ============================================================
// Helper: Check if Ollama is running
// ============================================================

export async function isOllamaAvailable(
  baseUrl = 'http://localhost:11434'
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}
