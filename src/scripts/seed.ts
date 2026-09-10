import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Employee } from "@/models/Employee";

// Datos de ejemplo genéricos — no cargo los sueldos/CUIT reales del Excel
// acá a propósito: este archivo probablemente termine en un repo git, y no
// es el lugar para datos reales de sueldos. Cargá los datos reales desde la
// UI una vez que el sistema esté levantado.
async function main() {
  await connectDB();

  const arielHash = await bcrypt.hash("5775", 10);
  const adminHash = await bcrypt.hash("admin2026", 10);

  await User.findOneAndUpdate(
    { email: "ariel" },
    { name: "Ariel", email: "ariel", passwordHash: arielHash, role: "OWNER" },
    { upsert: true }
  );

  await User.findOneAndUpdate(
    { email: "admin" },
    { name: "Contadora", email: "admin", passwordHash: adminHash, role: "ACCOUNTANT" },
    { upsert: true }
  );

  await Employee.findOneAndUpdate(
    { name: "Empleado de ejemplo" },
    { name: "Empleado de ejemplo", type: "ASALARIADO" },
    { upsert: true }
  );

  console.log("Seed listo. Cambiá las contraseñas antes de usar en producción.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});