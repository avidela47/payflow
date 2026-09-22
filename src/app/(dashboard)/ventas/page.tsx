import { connectDB } from "@/lib/db";
import { Client } from "@/models/Client";
import { Sale } from "@/models/Sale";
import { VentasClient, type SaleItem } from "./ventas-client";

export default async function VentasPage() {
  await connectDB();

  const [clients, sales] = await Promise.all([
    Client.find({}).sort({ nombre: 1 }).lean(),
    Sale.find({}).populate("client").sort({ saleDate: -1 }).limit(500).lean(),
  ]);

  const saleItems: SaleItem[] = sales.map((sale) => {
    // Si el cliente referenciado fue borrado, Mongoose deja `sale.client`
    // en null (no el id crudo) — mismo caso que en Sueldos/Costos Fijos.
    const clientDoc =
      sale.client && typeof sale.client === "object" && "nombre" in sale.client
        ? (sale.client as unknown as { _id: { toString(): string }; nombre: string })
        : null;

    return {
      id: sale._id.toString(),
      clientId: clientDoc ? clientDoc._id.toString() : `eliminado-${sale._id.toString()}`,
      clientName: clientDoc ? clientDoc.nombre : "Cliente eliminado",
      saleDateISO: sale.saleDate.toISOString().slice(0, 10),
      paymentMethod: sale.paymentMethod,
      expectedCollectionDateISO: sale.expectedCollectionDate
        ? sale.expectedCollectionDate.toISOString().slice(0, 10)
        : undefined,
      collected: sale.collected,
      collectedDateISO: sale.collectedDate ? sale.collectedDate.toISOString().slice(0, 10) : undefined,
      amount: sale.amount,
      currency: sale.currency ?? "ARS",
      usdAmount: sale.usdAmount,
      exchangeRate: sale.exchangeRate,
      remitoNumber: sale.remitoNumber,
      invoiceNumber: sale.invoiceNumber,
      purchaseOrderNumber: sale.purchaseOrderNumber,
      notes: sale.notes,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Registro de ventas por cliente, con seguimiento de cobro.
        </p>
      </div>

      <VentasClient
        clients={clients.map((c) => ({ id: c._id.toString(), nombre: c.nombre }))}
        sales={saleItems}
      />
    </div>
  );
}