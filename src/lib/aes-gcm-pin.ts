// Primitivas genéricas AES-GCM + PBKDF2 para los módulos que cifran datos
// con un PIN de equipo compartido (Accesos, Cómputo Privado). El original
// define esto una sola vez (accDeriveKey/accDecrypt/accEncrypt) y lo
// reusa en ambas pestañas con constantes de salt/iteraciones/verificador
// distintas por pestaña — acá se factoriza igual, en vez de duplicar el
// código en cada archivo de constantes.
//
// accesos-crypto.ts y computo-privado-crypto.ts solo aportan su propio
// SALT/ITER/VERIF y envuelven estas funciones; la matemática del cifrado
// es idéntica a propósito, porque ya hay datos reales en Firestore
// cifrados con ella.

// Devuelve BufferSource (no Uint8Array a secas): algunas versiones de los
// tipos de lib.dom exigen que el backing buffer sea ArrayBuffer, no
// ArrayBufferLike — con Uint8Array sin más, crypto.subtle.* no tipa.
export function b64ToBuf(s: string): BufferSource {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a as BufferSource;
}

export function bufToB64(buf: ArrayBuffer): string {
  const a = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
}

export async function pinDeriveKey(pin: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBuf(saltB64), iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function pinDecrypt(key: CryptoKey, iv: string, ct: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBuf(iv) }, key, b64ToBuf(ct));
  return new TextDecoder().decode(pt);
}

export async function pinEncrypt(key: CryptoKey, text: string): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: bufToB64(iv.buffer), ct: bufToB64(ct) };
}

// Deriva la clave a partir del PIN tipeado y la valida contra el blob de
// verificación de la pestaña que llama. Tira si el PIN es incorrecto.
export async function pinUnlock(
  pin: string,
  saltB64: string,
  iterations: number,
  verif: { iv: string; ct: string },
  expected: string
): Promise<CryptoKey> {
  const key = await pinDeriveKey(pin, saltB64, iterations);
  const ok = await pinDecrypt(key, verif.iv, verif.ct);
  if (ok !== expected) throw new Error("PIN incorrecto.");
  return key;
}
