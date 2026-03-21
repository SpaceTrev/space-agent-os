// ============================================================
// Voice note processing — download from Twilio + Whisper STT
// ============================================================

const TWILIO_SID = () => process.env.TWILIO_ACCOUNT_SID ?? ''
const TWILIO_TOKEN = () => process.env.TWILIO_AUTH_TOKEN ?? ''
const OPENAI_KEY = () => process.env.OPENAI_API_KEY ?? ''

// ============================================================
// Download media from Twilio
// ============================================================

async function downloadTwilioMedia(mediaUrl: string): Promise<Buffer> {
  const sid = TWILIO_SID()
  const token = TWILIO_TOKEN()

  const res = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    },
    redirect: 'follow',
  })

  if (!res.ok) {
    throw new Error(`Failed to download media: ${res.status}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ============================================================
// Transcribe audio via OpenAI Whisper
// ============================================================

export async function transcribeVoiceNote(mediaUrl: string): Promise<string> {
  const apiKey = OPENAI_KEY()

  if (!apiKey) {
    return '' // Caller should handle the empty-string case
  }

  const audioBuffer = await downloadTwilioMedia(mediaUrl)

  // Build multipart form
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' }), 'voice.ogg')
  formData.append('model', 'whisper-1')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[Voice] Whisper transcription failed (${res.status}):`, text)
    return ''
  }

  const data = (await res.json()) as { text?: string }
  return data.text?.trim() ?? ''
}
