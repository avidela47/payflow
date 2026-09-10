import "dotenv/config";
import { connectDB } from "@/lib/db";
import { PayrollEntry } from "@/models/PayrollEntry";

// Sincroniza los índices reales de Mongo con lo que dice el esquema actual:
// borra los que ya no están definidos en el código (como el viejo
// employee_1_period_1, de antes de que existiera "modalidad") y crea los
// que falten. Se corre una vez después de cambiar un índice único.
async function main() {
  await connectDB();
  console.log("Sincronizando índices de PayrollEntry...");
  const result = await PayrollEntry.syncIndexes();
  console.log("Listo. Índices actuales:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});