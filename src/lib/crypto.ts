import crypto from "crypto";

/**
 * Cifrado de campo para el vault de credenciales.
 *
 * La clave (VAULT_MASTER_KEY) vive SOLO en la variable de entorno del
 * servidor — nunca en el repo, nunca en la base de datos. Si esa variable
 * no existe, el sistema no debe levantar: es preferible que falle a
 * arrancar con secretos sin proteger.
 *
 * Rotar la clave implica re-cifrar todas las VaultEntry existentes; no hay
 * versión automática de esto todavía (queda anotado como deuda conocida).
 */

const ALGORITHM = "aes-256-gcm";

function getMasterKey(): Buffer {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "VAULT_MASTER_KEY no está configurada o es demasiado corta (mínimo 32 caracteres)."
    );
  }
  return crypto.createHash("sha256").update(key).digest();
}

export function encryptSecret(plainText: string): {
  encryptedValue: string;
  iv: string;
  authTag: string;
} {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(params: {
  encryptedValue: string;
  iv: string;
  authTag: string;
}): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getMasterKey(),
    Buffer.from(params.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(params.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(params.encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
