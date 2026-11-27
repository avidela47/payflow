import "dotenv/config";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

// Script de uso recurrente (2026-11-27): Ariel va a ir pasando, de a poco,
// a qué mail real quiere que le lleguen los avisos de Calendario a cada
// usuario (ver User.notificationEmail y lib/agenda-digest.ts — antes todo
// el mundo caía en un solo mail fijo, ahora cada uno con mail propio
// cargado acá recibe solo SUS eventos del día). A medida que me vaya
// pasando pares "usuario -> mail" los agrego a MAPEO de abajo y Ariel
// vuelve a correr este script.
//
// Corre en dos modos, igual que cargar-fotos-empleados.ts:
//   npx tsx src/scripts/set-notification-emails.ts            → solo informa
//   npx tsx src/scripts/set-notification-emails.ts --apply     → aplica
//
// No se borra después de usarlo (a diferencia de otros scripts de una
// sola vez): se va a seguir editando y corriendo cada vez que haya mails
// nuevos para cargar.

const MAPEO: { username: string; notificationEmail: string }[] = [
  { username: "ariel", notificationEmail: "ventas@itelsasas.com" },
  { username: "florencia", notificationEmail: "admin@itelsasas.com" },
  { username: "ruben", notificationEmail: "rpozzo@itelsasas.com" },
  { username: "candelaria", notificationEmail: "mcsotgiu@itelsasas.com" },
  { username: "sofia", notificationEmail: "comunicacion.mkt@itelsasas.com" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDB();

  console.log(apply ? "=== MODO APLICAR (va a escribir cambios) ===" : "=== MODO INFORME (no escribe nada) ===");
  console.log("");

  if (MAPEO.length === 0) {
    console.log("MAPEO está vacío — no hay nada para cargar todavía.");
    process.exit(0);
  }

  let aplicados = 0;
  let sinCuenta = 0;

  for (const m of MAPEO) {
    const user = await User.findOne({ email: m.username });
    if (!user) {
      console.log(`[${m.username}] ⚠ no existe ninguna cuenta de login con ese nombre de usuario`);
      sinCuenta++;
      continue;
    }

    const actual = user.notificationEmail;
    const yaEstaba = actual === m.notificationEmail;
    console.log(
      `[${m.username}] cuenta OK | notificationEmail actual: ${actual ?? "(vacío)"} ${
        yaEstaba ? "= sin cambios" : `→ ${apply ? "se actualiza a" : "pasaría a"} ${m.notificationEmail}`
      }`
    );

    if (apply && !yaEstaba) {
      user.notificationEmail = m.notificationEmail;
      await user.save();
      aplicados++;
    }
  }

  console.log("");
  console.log(`Resumen: ${aplicados} actualizados, ${sinCuenta} sin cuenta de login encontrada.`);
  if (!apply) {
    console.log("Esto fue solo el informe. Si está todo bien, corré de nuevo con --apply para aplicar.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
