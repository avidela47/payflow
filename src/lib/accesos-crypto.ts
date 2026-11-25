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
//
// Las primitivas AES-GCM/PBKDF2 en sí viven en aes-gcm-pin.ts (compartidas
// con computo-privado-crypto.ts, que usa el mismo esquema con su propio
// salt/iteraciones/verificador) — acá solo quedan las constantes de Accesos
// y el envoltorio con su forma de datos.
import { pinUnlock, pinDecrypt, pinEncrypt } from "./aes-gcm-pin";

const ACC_SALT = "YanlaquyXcN706IvcUxG/g==";
const ACC_VERIF = { iv: "3vYC9gwbY/MB9fmS", ct: "M62TYdGu6WOAGgUgjPZO6S3XkikRxexiNfV9GuT3A+lS" };
const ACC_ITER = 250000;

export async function accUnlock(pin: string): Promise<CryptoKey> {
  return pinUnlock(pin, ACC_SALT, ACC_ITER, ACC_VERIF, "itelsa-accesos-ok");
}

export type AccesoDatos = { nombre: string; cat?: string; link?: string; usuario?: string; clave?: string; notas?: string };

export async function accesoDescifrar(key: CryptoKey, iv: string, ct: string): Promise<AccesoDatos> {
  const txt = await pinDecrypt(key, iv, ct);
  return JSON.parse(txt) as AccesoDatos;
}

export async function accesoCifrar(key: CryptoKey, datos: AccesoDatos): Promise<{ iv: string; ct: string }> {
  return pinEncrypt(key, JSON.stringify(datos));
}
