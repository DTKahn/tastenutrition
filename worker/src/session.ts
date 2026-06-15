// Stateless, encrypted session tokens.
//
// We never store passwords and never run a database. After login we hold only
// the parent's Taste session cookie, and we keep *that* on the client by
// encrypting it into an opaque app token (AES-GCM with a Worker secret). Each
// request decrypts the token, uses the cookie upstream, and forgets it. If the
// secret rotates or the token expires, the parent simply logs in again.

interface SessionPayload {
  /** The raw `ASPSESSIONIDxxxx=value` cookie pair for tastenutrition.com. */
  cookie: string;
  /** Epoch seconds when this token should no longer be accepted. */
  exp: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(secret: string): Promise<CryptoKey> {
  // Hash the secret to a fixed 256-bit key; AES-GCM needs an exact length.
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function createToken(
  secret: string,
  cookie: string,
  ttlSeconds: number,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload: SessionPayload = {
    cookie,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify(payload)),
    ),
  );
  // token = iv . ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return b64urlEncode(combined);
}

/** Returns the Taste cookie, or null if the token is invalid/expired. */
export async function readToken(
  secret: string,
  token: string,
): Promise<string | null> {
  try {
    const key = await deriveKey(secret);
    const combined = b64urlDecode(token);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    const payload = JSON.parse(dec.decode(plain)) as SessionPayload;
    if (!payload.cookie || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload.cookie;
  } catch {
    return null;
  }
}
