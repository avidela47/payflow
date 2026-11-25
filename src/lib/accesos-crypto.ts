// Cifrado de Accesos — port literal de accDeriveKey/accDecrypt/accEncrypt y
// las constantes ACC_SALT/ACC_ITER/ACC_VERIF (líneas 1873-1891 del original).
//
// Estas 3 constantes tienen que ser EXACTAMENTE las mismas que las del
// original: la colección "accesos" en Firestore ya tiene datos reales,
// cifrados con el PIN de equipo actual usando este salt+iteraciones. Si acá
// se generara un salt nuevo, PayFlow jamás podría descifrar lo que ya existe
// (ni lo que cargue proyectos-itelsa.itelsasas.com en paralelo). El PIN en sí
// NO está en ningún lado del código — ni acá ni en el original — solo se
// valida intentando descifrar ACC_VERIF con la clave derivada del PIN que se
// tipeó; si da el texto esperado, el PIN es correcto.
const ACC_SALT = "YanlaquyXcN706IvcUxG/g==";
const ACC_VERIF = { iv: "3vYC9gwbY/MB9fmS", ct: "M62TYdGu6WOAGgUgjPZO6S3XkikRxexiNfV9GuT3A+lS" };
const ACC_ITER = 250000;

// Devuelve BufferSource (no Uint8Array a secas): algunas versiones de los
// tipos de lib.dom exigen que el backing buffer sea ArrayBuffer, no
// ArrayBufferLike — con Uint8Array sin más, crypto.subtle.* no tipa.
function b64ToBuf(s: string): BufferSource {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a as BufferSource;
}

function bufToB64(buf: ArrayBuffer): string {
  const a = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
}

async function accDeriveKey(pin: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBuf(ACC_SALT), iterations: ACC_ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function accDecrypt(key: CryptoKey, iv: string, ct: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBuf(iv) }, key, b64ToBuf(ct));
  return new TextDecoder().decode(pt);
}

async function accEncrypt(key: CryptoKey, text: string): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: bufToB64(iv.buffer), ct: bufToB64(ct) };
}

// Deriva la clave a partir del PIN tipeado y la valida contra ACC_VERIF.
// Tira si el PIN es incorrecto (o si algo del cifrado falla).
export async function accUnlock(pin: string): Promise<CryptoKey> {
  const key = await accDeriveKey(pin);
  const ok = await accDecrypt(key, ACC_VERIF.iv, ACC_VERIF.ct);
  if (ok !== "itelsa-accesos-ok") throw new Error("PIN incorrecto.");
  return key;
}

export type AccesoDatos = { nombre: string; cat?: string; link?: string; usuario?: string; clave?: string; notas?: string };

export async function accesoDescifrar(key: CryptoKey, iv: string, ct: string): Promise<AccesoDatos> {
  const txt = await accDecrypt(key, iv, ct);
  return JSON.parse(txt) as AccesoDatos;
}

export async function accesoCifrar(key: CryptoKey, datos: AccesoDatos): Promise<{ iv: string; ct: string }> {
  return accEncrypt(key, JSON.stringify(datos));
}
