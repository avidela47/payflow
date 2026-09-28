import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { PettyCashMovement } from "@/models/PettyCash";
import { CajaChicaClient, type PettyCashMovementItem } from "./caja-chica-client";

export default async function CajaChicaPage() {
  await requireModuleAccess("caja-chica");
  await connectDB();

  // El saldo sale de TODOS los movimientos (agregación aparte), no solo de
  // los últimos 500 que se muestran en la tabla — así nunca queda mal
  // calculado a medida que crece el historial.
  const [movements, balanceAgg] = await Promise.all([
    PettyCashMovement.find({}).sort({ date: -1, createdAt: -1 }).limit(500).lean(),
    PettyCashMovement.aggregate([
      {
        $group: {
          _id: null,
          ingresos: { $sum: { $cond: [{ $eq: ["$type", "ingreso"] }, "$amount", 0] } },
          egresos: { $sum: { $cond: [{ $eq: ["$type", "egreso"] }, "$amount", 0] } },
        },
      },
    ]),
  ]);

  const balance = balanceAgg[0] ? balanceAgg[0].ingresos - balanceAgg[0].egresos : 0;

  const items: PettyCashMovementItem[] = movements.map((m) => ({
    id: m._id.toString(),
    dateISO: m.date.toISOString().slice(0, 10),
    concept: m.concept,
    amount: m.amount,
    type: m.type,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Caja Chica</h1>
        <p className="text-sm text-muted-foreground">
          Efectivo aparte para gastos corrientes. No concilia con Costos Fijos ni Gastos.
        </p>
      </div>

      <CajaChicaClient movements={items} balance={balance} />
    </div>
  );
}