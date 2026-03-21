// ============================================================
// Agent OS — Google Gemini Provider
// ============================================================

import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type Tool,
  type FunctionDeclaration,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai'
import type { ModelCallOptions, ModelCallResult, ModelMessage, ModelTool } from '@/lib/types'

// ============================================================
// Convert our generic message format to Gemini Content format
// ============================================================

function toGeminiContents(messages: ModelMessage[]): Content[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m): Content => {
      const role = m.role === 'assistant' ? 'model' : 'user'

      if (typeof m.content === 'string') {
        return { role, parts: [{ text: m.content }] }
      }

      const parts: Part[] = m.content.map((block) => {
        if (block.type === 'text') {
          return { text: block.text ?? '' }
        }
        if (block.type === 'image_url' && block.image_url) {
          const url = block.image_url.url
          if (url.startsWith('data:')) {
            const [header, data] = url.split(',')
            const mimeType = header.split(':')[1].split(';')[0]
            return { inlineData: { mimeType, data } }
          }
          // URL-based images not directly supported — wrap as text
          return { text: `[Image: ${url}]` }
        }
        if (block.type === 'tool_use') {
          return {
            functionCall: {
              name: block.name ?? '',
              args: block.input ?? {},
            },
          }
        }
        if (block.type === 'tool_result') {
          return {
            functionResponse: {
              name: m.name ?? 'tool',
              response: { result: block.content ?? '' },
            },
          }
        }
        return { text: '' }
      })

      return { role, parts }
    })
}

// ============================================================
// Convert our generic tools to Gemini function declarations
// ============================================================

function toGeminiFunctionDeclarations(tools: ModelTool[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters as any,
  }))
}

// ============================================================
// Extract system instruction from messages
// ============================================================

function extractSystemInstruction(
  messages: ModelMessage[],
  explicitSystem?: string
): string | undefined {
  const fromMessages = messages
    .filter((m) => m.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n\n')

  if (explicitSystem && fromMessages) return `${explicitSystem}\n\n${fromMessages}`
  return explicitSystem ?? fromMessages ?? undefined
}

// ============================================================
// Main callGeminiModel function
// ============================================================

export async function callGeminiModel(
  options: ModelCallOptions
): Promise<ModelCallResult> {
  const apiKey = options.api_key ?? process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Gemini API key is required. Set GEMINI_API_KEY or pass api_key.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  const systemInstruction = extractSystemInstruction(options.messages, options.system)
  const contents = toGeminiContents(options.messages)

  const tools: Tool[] | undefined =
    options.tools && options.tools.length > 0
      ? [{ functionDeclarations: toGeminiFunctionDeclarations(options.tools) }]
      : undefined

  const model = genAI.getGenerativeModel({
    model: options.model,
    systemInstruction: systemInstruction || undefined,
    generationConfig: {
      maxOutputTokens: options.max_tokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    ...(tools ? { tools } : {}),
  })

  const result = await model.generateContent({ contents })
  const response = result.response

  // Extract text and function calls
  let textContent = ''
  const toolCalls: ModelCallResult['tool_calls'] = []

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.text) {
      textContent += part.text
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `${part.functionCall.name}-${Date.now()}`,
        name: part.functionCall.name,
        arguments: (part.functionCall.args ?? {}) as Record<string, unknown>,
      })
    }
  }

  // Token counts (Gemini provides these)
  const usageMeta = response.usageMetadata
  const inputTokens = usageMeta?.promptTokenCount ?? 0
  const outputTokens = usageMeta?.candidatesTokenCount ?? 0

  // Determine finish reason
  const stopReason = response.candidates?.[0]?.finishReason
  let finishReason: ModelCallResult['finish_reason'] = 'stop'
  if (stopReason === 'MAX_TOKENS') finishReason = 'max_tokens'
  else if (toolCalls.length > 0) finishReason = 'tool_use'

  return {
    content: textContent,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    tokens_input: inputTokens,
    tokens_output: outputTokens,
    model: options.model,
    provider: 'gemini',
    finish_reason: finishReason,
    raw: response,
  }
}
