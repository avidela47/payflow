import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { FixedCostCategory, FixedCostEntry } from "@/models/FixedCost";
import { formatPeriod } from "@/lib/utils";
import { ensureDefaultCategories } from "./actions";
import { CostosFijosClient, type FixedCostEntryItem } from "./costos-fijos-client";

function formatDueDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    date
  );
}

export default async function CostosFijosPage() {
  await requireModuleAccess("costos-fijos");
  await ensureDefaultCategories();
  await connectDB();

  const [categories, entries] = await Promise.all([
    FixedCostCategory.find({}).sort({ name: 1 }).lean(),
    FixedCostEntry.find({}).populate("category").sort({ period: -1 }).limit(200).lean(),
  ]);

  const entryItems: FixedCostEntryItem[] = entries.map((entry) => {
    // Si el empleado/categoría referenciada fue borrada, Mongoose deja
    // `entry.category` en null (no el id crudo) — usamos el id de la propia
    // liquidación como respaldo para no crashear (mismo caso que en Sueldos).
    const categoryDoc =
      entry.category && typeof entry.category === "object" && "name" in entry.category
        ? (entry.category as unknown as { _id: { toString(): string }; name: string })
        : null;

    return {
      id: entry._id.toString(),
      categoryId: categoryDoc ? categoryDoc._id.toString() : `huerfano-${entry._id.toString()}`,
      categoryName: categoryDoc ? categoryDoc.name : "Categoría eliminada",
      periodISO: entry.period.toISOString(),
      periodLabel: formatPeriod(entry.period),
      amount: entry.amount,
      currency: entry.currency ?? "ARS",
      usdAmount: entry.usdAmount,
      exchangeRate: entry.exchangeRate,
      paymentMode: entry.paymentMode,
      dueDateISO: entry.dueDate ? entry.dueDate.toISOString().slice(0, 10) : undefined,
      dueDateLabel: entry.dueDate ? formatDueDate(entry.dueDate) : undefined,
      notes: entry.notes,
      paid: entry.paid,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Costos Fijos</h1>
        <p className="text-sm text-muted-foreground">
          Impuestos y gastos fijos por período (IIBB, IVA, SICORE, F931, etc.)
        </p>
      </div>

      <CostosFijosClient
        categories={categories.map((c) => ({ id: c._id.toString(), name: c.name }))}
        entries={entryItems}
      />
    </div>
  );
}