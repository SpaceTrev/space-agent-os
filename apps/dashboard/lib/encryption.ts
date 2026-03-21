// ============================================================
// Agent OS — AES-256-GCM Encryption for API Keys
// Used to securely store provider API keys in the database
// ============================================================

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

// ============================================================
// Constants
// ============================================================

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16  // 128-bit authentication tag
const KEY_LENGTH = 32  // 256-bit key

// ============================================================
// Get the encryption key from environment
// ============================================================

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error(
      'Missing ENCRYPTION_KEY environment variable. ' +
      'Generate one with: openssl rand -hex 32'
    )
  }

  // Accept both hex (64 chars) and raw base64 keys
  let keyBuffer: Buffer
  if (keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex)) {
    keyBuffer = Buffer.from(keyHex, 'hex')
  } else {
    keyBuffer = Buffer.from(keyHex, 'base64')
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes. ` +
      `Got ${keyBuffer.length} bytes. ` +
      'Generate a valid key with: openssl rand -hex 32'
    )
  }

  return keyBuffer
}

// ============================================================
// EncryptedValue — what we store in the database
// ============================================================

export interface EncryptedValue {
  /** Base64-encoded ciphertext + authentication tag */
  ciphertext: string
  /** Base64-encoded initialization vector */
  iv: string
}

// ============================================================
// Encrypt a plaintext string
// ============================================================

export function encrypt(plaintext: string): EncryptedValue {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
  }
}

// ============================================================
// Decrypt a previously encrypted value
// ============================================================

export function decrypt(encrypted: EncryptedValue): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(encrypted.iv, 'base64')
  const ciphertextWithTag = Buffer.from(encrypted.ciphertext, 'base64')

  // Separate the ciphertext from the auth tag
  const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - TAG_LENGTH)
  const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

// ============================================================
// Encrypt an API key for storage in DB
// Returns { encrypted_api_key, iv } matching the DB schema
// ============================================================

export function encryptApiKey(apiKey: string): { encrypted_api_key: string; iv: string } {
  const { ciphertext, iv } = encrypt(apiKey)
  return { encrypted_api_key: ciphertext, iv }
}

// ============================================================
// Decrypt an API key retrieved from DB
// ============================================================

export function decryptApiKey(encryptedApiKey: string, iv: string): string {
  return decrypt({ ciphertext: encryptedApiKey, iv })
}

// ============================================================
// Safe decrypt — returns null on failure instead of throwing
// ============================================================

export function safeDecryptApiKey(
  encryptedApiKey: string | null,
  iv: string | null
): string | null {
  if (!encryptedApiKey || !iv) return null
  try {
    return decryptApiKey(encryptedApiKey, iv)
  } catch {
    return null
  }
}

// ============================================================
// Generate a random encryption key (for setup / rotation)
// ============================================================

export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex')
}

// ============================================================
// Hash a value (one-way, for comparisons)
// ============================================================

import { createHash } from 'crypto'

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// ============================================================
// Mask an API key for display (show first 4 + last 4 chars)
// ============================================================

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****'
  const prefix = apiKey.slice(0, 4)
  const suffix = apiKey.slice(-4)
  const masked = '*'.repeat(Math.min(apiKey.length - 8, 16))
  return `${prefix}${masked}${suffix}`
}
