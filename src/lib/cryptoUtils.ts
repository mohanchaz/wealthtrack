/**
 * Client-side AES-GCM encryption using Web Crypto API.
 *
 * Encryption key is derived from the user's Supabase user ID using PBKDF2.
 * The plaintext never leaves the browser unencrypted.
 *
 * Encrypted format (stored as base64):
 *   [12-byte IV][encrypted ciphertext]
 */

const APP_SALT = 'wealthtrack-infolio-v1'
const PBKDF2_ITERATIONS = 100_000

// Derive an AES-256-GCM key from the userId
async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(userId + APP_SALT),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return window.crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       enc.encode(APP_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encode ArrayBuffer → base64 string
function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

// Decode base64 string → Uint8Array
function b64ToBuf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

/**
 * Encrypt a plaintext string for a given userId.
 * Returns a base64-encoded string: [IV (12 bytes)][ciphertext].
 */
export async function encrypt(plaintext: string, userId: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await deriveKey(userId)
  const iv  = window.crypto.getRandomValues(new Uint8Array(12))

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )

  // Concat IV + ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)

  return bufToB64(combined.buffer)
}

/**
 * Decrypt a base64 string previously encrypted with encrypt().
 * Returns the plaintext, or null if decryption fails.
 */
export async function decrypt(b64: string, userId: string): Promise<string | null> {
  try {
    const key  = await deriveKey(userId)
    const data = b64ToBuf(b64)
    const iv   = data.slice(0, 12)
    const body = data.slice(12)

    const plainBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      body
    )

    return new TextDecoder().decode(plainBuf)
  } catch {
    return null
  }
}
