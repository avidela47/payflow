import "dotenv/config";
import { connectDB } from "@/lib/db";
import { PayrollEntry } from "@/models/PayrollEntry";

// Lista los índices reales que existen HOY en la colección de Mongo
// (no lo que dice el esquema). Sirve para confirmar si el índice viejo
// employee_1_period_1 (sin modalidad) sigue ahí o no.
async function main() {
  await connectDB();
  const indexes = await PayrollEntry.collection.indexes();
  console.log("Índices reales en la colección payrollentries:");
  console.log(JSON.stringify(indexes, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});