import nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte base64 or hex

function getKey(): Uint8Array {
  if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not set");
  const decoded = naclUtil.decodeBase64(ENCRYPTION_KEY);
  if (decoded.length !== nacl.secretbox.keyLength) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64)");
  }
  return decoded;
}

export function encrypt(plain: string): string {
  const key = getKey();
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const message = naclUtil.decodeUTF8(plain);
  const box = nacl.secretbox(message, nonce, key);
  const combined = new Uint8Array(nonce.length + box.length);
  combined.set(nonce);
  combined.set(box, nonce.length);
  return naclUtil.encodeBase64(combined);
}

export function decrypt(cipher: string): string {
  const key = getKey();
  const combined = naclUtil.decodeBase64(cipher);
  const nonce = combined.slice(0, nacl.secretbox.nonceLength);
  const box = combined.slice(nacl.secretbox.nonceLength);
  const message = nacl.secretbox.open(box, nonce, key);
  if (!message) throw new Error("Decryption failed");
  return naclUtil.encodeUTF8(message);
}

export function hasEncryptionKey(): boolean {
  return Boolean(ENCRYPTION_KEY);
}
