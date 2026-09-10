import { connectDB } from "@/lib/db";
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
  await ensureDefaultCategories();
  await connectDB();

  const [categories, entries] = await Promise.all([
    FixedCostCategory.find({}).sort({ name: 1 }).lean(),
    FixedCostEntry.find({}).populate("category").sort({ period: -1 }).limit(200).lean(),
  ]);

  const entryItems: FixedCostEntryItem[] = entries.map((entry) => {
    // Con `.lean()` + `.populate()`, `category` puede venir como el
    // documento completo o quedar como solo el id si la referencia está
    // rota — cubrimos los dos casos.
    const categoryDoc =
      entry.category && typeof entry.category === "object" && "name" in entry.category
        ? (entry.category as unknown as { _id: { toString(): string }; name: string })
        : null;

    return {
      id: entry._id.toString(),
      categoryId: categoryDoc ? categoryDoc._id.toString() : entry.category.toString(),
      categoryName: categoryDoc ? categoryDoc.name : "Categoría eliminada",
      periodISO: entry.period.toISOString(),
      periodLabel: formatPeriod(entry.period),
      amount: entry.amount,
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