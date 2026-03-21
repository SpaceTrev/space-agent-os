// ============================================================
// POST /api/webhooks/whatsapp — Twilio WhatsApp webhook
// Receives incoming WhatsApp messages (text & voice notes)
// and routes them through the command system.
// ============================================================

import { NextRequest } from 'next/server'
import { verifyTwilioSignature } from '@/lib/whatsapp/client'
import { routeCommand } from '@/lib/whatsapp/router'
import { transcribeVoiceNote } from '@/lib/whatsapp/voice'

// Twilio sends form-encoded POST bodies
async function parseFormBody(req: NextRequest): Promise<Record<string, string>> {
  const text = await req.text()
  const params: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [key, ...rest] = pair.split('=')
    params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='))
  }
  return params
}

// Wrap reply text in TwiML
function twiml(message: string): Response {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Message>${escapeXml(message)}</Message>`,
    '</Response>',
  ].join('\n')

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ============================================================
// Main handler
// ============================================================

export async function POST(req: NextRequest) {
  // Clone the request so we can read the body twice if needed
  const rawBody = await req.text()
  const params: Record<string, string> = {}
  for (const pair of rawBody.split('&')) {
    const [key, ...rest] = pair.split('=')
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='))
  }

  // ---- Signature verification ----
  const token = process.env.TWILIO_AUTH_TOKEN
  if (token) {
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const webhookUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/webhooks/whatsapp`

    if (!verifyTwilioSignature(webhookUrl, params, signature)) {
      return new Response('Invalid signature', { status: 401 })
    }
  }

  const from = params['From'] ?? ''
  const body = params['Body'] ?? ''
  const numMedia = parseInt(params['NumMedia'] ?? '0', 10)

  try {
    let commandText = body

    // ---- Voice note handling ----
    if (numMedia > 0) {
      const contentType = params['MediaContentType0'] ?? ''

      if (contentType.startsWith('audio/')) {
        const mediaUrl = params['MediaUrl0'] ?? ''

        if (!process.env.OPENAI_API_KEY) {
          return twiml('Voice notes require an OpenAI API key to be configured. Please send a text command instead.')
        }

        const transcript = await transcribeVoiceNote(mediaUrl)

        if (!transcript) {
          return twiml('Could not transcribe your voice note. Please try again or send a text command.')
        }

        commandText = transcript
      }
    }

    // ---- Route the command ----
    if (!commandText.trim()) {
      return twiml('Send /help to see available commands.')
    }

    const reply = await routeCommand(commandText, from)
    return twiml(reply)
  } catch (err) {
    console.error('[WhatsApp Webhook] Error:', err)
    return twiml('An error occurred processing your message. Please try again.')
  }
}
