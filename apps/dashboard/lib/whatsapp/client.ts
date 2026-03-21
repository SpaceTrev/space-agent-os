// ============================================================
// Twilio WhatsApp client — send messages & verify signatures
// ============================================================

import { createHmac } from 'crypto'

const TWILIO_SID = () => process.env.TWILIO_ACCOUNT_SID ?? ''
const TWILIO_TOKEN = () => process.env.TWILIO_AUTH_TOKEN ?? ''
const TWILIO_FROM = () => process.env.TWILIO_WHATSAPP_NUMBER ?? 'whatsapp:+14155238886'

// ============================================================
// Send a WhatsApp message via Twilio REST API
// ============================================================

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const sid = TWILIO_SID()
  const token = TWILIO_TOKEN()

  if (!sid || !token) {
    console.warn('[WhatsApp] Twilio credentials not configured — skipping send')
    return
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`

  const params = new URLSearchParams({
    To: to,
    From: TWILIO_FROM(),
    Body: body,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[WhatsApp] Send failed (${res.status}):`, text)
  }
}

// ============================================================
// Verify Twilio X-Twilio-Signature (HMAC-SHA1)
// https://www.twilio.com/docs/usage/security#validating-requests
// ============================================================

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const token = TWILIO_TOKEN()
  if (!token) return false

  // Build the data string: URL + sorted param key-value pairs
  const sortedKeys = Object.keys(params).sort()
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url)

  const expected = createHmac('sha1', token).update(data, 'utf-8').digest('base64')

  return expected === signature
}
