// Cifrado de Cómputo Privado — port literal de CZ_SALT/CZ_ITER/CZ_VERIF y
// czDeriveKey/czUnlock (líneas 4149-4174 del original). El original REUSA
// accDecrypt/accEncrypt de Accesos para cifrar/descifrar (misma matemática,
// constantes propias) — acá se usa el mismo envoltorio genérico
// (aes-gcm-pin.ts) por el mismo motivo.
//
// Estas 3 constantes tienen que ser EXACTAMENTE las mismas que las del
// original: la colección "cotizaciones" en Firestore ya tiene datos reales
// cifrados con el PIN de equipo actual usando este salt+iteraciones.
//
// A diferencia de Accesos (un AccesoDatos chico por doc), acá cada doc
// guarda el ComputoValorizado COMPLETO (items, proyecto, moneda, notas...)
// como un único blob JSON cifrado — por eso czDescifrar/czCifrar no tienen
// una forma fija de "datos", trabajan con el tipo ComputoValorizado de
// computo-privado.ts.
import { pinUnlock, pinDecrypt, pinEncrypt } from "./aes-gcm-pin";

const CZ_SALT = "CEagfhyhPL4oL8HnLGHLtQ==";
const CZ_ITER = 150000;
const CZ_VERIF = { iv: "7fgDJ7iAcqUWP8Cz", ct: "hExZb9mLfBLY9krcCSaoM8RrYRqr3Yd3EZdtSYpn+w==" };

export async function czUnlock(pin: string): Promise<CryptoKey> {
  return pinUnlock(pin, CZ_SALT, CZ_ITER, CZ_VERIF, "itelsa-cotiz-ok");
}

export async function czDescifrarTexto(key: CryptoKey, iv: string, ct: string): Promise<string> {
  return pinDecrypt(key, iv, ct);
}

export async function czCifrarTexto(key: CryptoKey, texto: string): Promise<{ iv: string; ct: string }> {
  return pinEncrypt(key, texto);
}
