import { connectDB } from "@/lib/db";
import { Provider } from "@/models/Provider";
import { Purchase } from "@/models/Purchase";
import { ComprasClient, type PurchaseItem } from "./compras-client";

export default async function ComprasPage() {
  await connectDB();

  const [providers, purchases] = await Promise.all([
    Provider.find({}).sort({ nombre: 1 }).lean(),
    Purchase.find({}).populate("provider").sort({ purchaseDate: -1 }).limit(500).lean(),
  ]);

  const purchaseItems: PurchaseItem[] = purchases.map((purchase) => {
    // Si el proveedor referenciado fue borrado, Mongoose deja
    // `purchase.provider` en null (no el id crudo) — mismo caso que en
    // Ventas.
    const providerDoc =
      purchase.provider && typeof purchase.provider === "object" && "nombre" in purchase.provider
        ? (purchase.provider as unknown as { _id: { toString(): string }; nombre: string })
        : null;

    return {
      id: purchase._id.toString(),
      providerId: providerDoc ? providerDoc._id.toString() : `eliminado-${purchase._id.toString()}`,
      providerName: providerDoc ? providerDoc.nombre : "Proveedor eliminado",
      purchaseDateISO: purchase.purchaseDate.toISOString().slice(0, 10),
      paymentMethod: purchase.paymentMethod,
      expectedPaymentDateISO: purchase.expectedPaymentDate
        ? purchase.expectedPaymentDate.toISOString().slice(0, 10)
        : undefined,
      paid: purchase.paid,
      paidDateISO: purchase.paidDate ? purchase.paidDate.toISOString().slice(0, 10) : undefined,
      receiptStatus: purchase.receiptStatus,
      amount: purchase.amount,
      currency: purchase.currency ?? "ARS",
      usdAmount: purchase.usdAmount,
      exchangeRate: purchase.exchangeRate,
      remitoNumber: purchase.remitoNumber,
      invoiceNumber: purchase.invoiceNumber,
      purchaseOrderNumber: purchase.purchaseOrderNumber,
      notes: purchase.notes,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Compras</h1>
        <p className="text-sm text-muted-foreground">
          Registro de compras por proveedor, con seguimiento de recepción y pago.
        </p>
      </div>

      <ComprasClient
        providers={providers.map((p) => ({ id: p._id.toString(), nombre: p.nombre }))}
        purchases={purchaseItems}
      />
    </div>
  );
}