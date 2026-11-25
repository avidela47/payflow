import "dotenv/config";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

// Script de un solo uso (2026-11-25): Ariel corrió `create-users` con el
// nombre "melisa" antes de corregirlo a "melina" — eso dejó un usuario
// huérfano en la base con el nombre viejo. Esto lo borra. Correr una vez
// con `npx tsx src/scripts/delete-melisa.ts` y después borrar el archivo.
async function main() {
  await connectDB();
  const result = await User.deleteOne({ email: "melisa" });
  console.log(
    result.deletedCount > 0
      ? 'Listo. Se borró el usuario "melisa".'
      : 'No había ningún usuario con email "melisa" — no se borró nada.'
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
