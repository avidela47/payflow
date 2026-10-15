import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { VaultEntry } from "@/models/Vault";

// Migración de una sola vez: hoy todas las credenciales del vault son de
// la contadora (no tienen dueño asignado porque recién se agregó el campo
// `owner` al modelo). Le asignamos todas las que existan a su usuario
// (role: "ACCOUNTANT") y de ahí en adelante cada uno crea las suyas.
// Se corre una vez con `npx tsx scripts/migrar-vault-contadora.ts` y
// después se borra el archivo.
async function main() {
  await connectDB();

  const accountant = await User.findOne({ role: "ACCOUNTANT" });
  if (!accountant) {
    throw new Error('No se encontró ningún usuario con role "ACCOUNTANT". No se tocó nada.');
  }

  const sinDueno = await VaultEntry.countDocuments({ owner: { $exists: false } });
  if (sinDueno === 0) {
    console.log("No hay credenciales sin dueño. No hay nada que migrar.");
    return;
  }

  const result = await VaultEntry.updateMany(
    { owner: { $exists: false } },
    { $set: { owner: accountant._id } }
  );

  console.log(
    `Listo. ${result.modifiedCount} credencial(es) asignada(s) a ${accountant.name} (${accountant.email}).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });