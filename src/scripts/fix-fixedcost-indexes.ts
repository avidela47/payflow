import "dotenv/config";
import { connectDB } from "@/lib/db";
import { FixedCostEntry } from "@/models/FixedCost";

// Sincroniza los índices reales de Mongo con lo que dice el esquema
// actual: el índice único de FixedCostEntry pasó de category+período a
// category+período+moneda (para poder cargar, ej., el alquiler en pesos
// Y en dólares el mismo mes). Se corre una vez después de este cambio.
// No hace falta backup ni limpieza antes: el índice viejo era MÁS
// estricto que el nuevo, así que no puede haber datos que lo violen.
async function main() {
  await connectDB();
  console.log("Sincronizando índices de FixedCostEntry...");
  const result = await FixedCostEntry.syncIndexes();
  console.log("Listo. Índices actuales:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});