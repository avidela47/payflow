import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Payment } from "@/models/Payment";
import { Provider } from "@/models/Provider";
import { RetentionRegime } from "@/models/RetentionRegime";
import { Purchase } from "@/models/Purchase";
import { Check } from "@/models/Check";
import { PagosClient, type PaymentListItem, type ProviderOption, type RegimeOption } from "./pagos-client";

export default async function PagosPage() {
  await requireModuleAccess("pagos");
  await connectDB();

  const [providers, regimes, payments] = await Promise.all([
    Provider.find({}, "nombre condicionGanancias").sort({ nombre: 1 }).lean(),
    RetentionRegime.find({ activo: true }).sort({ codigo: 1 }).lean(),
    Payment.find({})
      .sort({ paymentDate: -1 })
      .limit(60)
      .populate("provider", "nombre")
      .populate("purchases.purchase", "invoiceNumber")
      .populate("checks.check", "issuingBank checkNumber amount paymentDate")
      .lean(),
  ]);

  const providerOptions: ProviderOption[] = providers.map((p) => ({
    id: p._id.toString(),
    nombre: p.nombre,
    condicionGanancias: p.condicionGanancias ?? null,
  }));

  const regimeOptions: RegimeOption[] = regimes.map((r) => ({
    id: r._id.toString(),
    codigo: r.codigo,
    concepto: r.concepto,
    alicuotaInscripto: r.alicuotaInscripto,
    alicuotaNoInscripto: r.alicuotaNoInscripto,
    montoNoImponible: r.montoNoImponible,
  }));

  const paymentItems: PaymentListItem[] = payments.map((pay) => {
    const providerDoc = pay.provider as unknown as { nombre?: string } | null;
    const invoiceNumbers = (pay.purchases ?? [])
      .map((line) => (line.purchase as unknown as { invoiceNumber?: string } | null)?.invoiceNumber)
      .filter((n): n is string => Boolean(n));
    const checksSummary = (pay.checks ?? [])
      .map((line) => line.check as unknown as {
        issuingBank?: string;
        checkNumber?: string;
        amount?: number;
        paymentDate?: Date;
      } | null)
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({
        bank: c.issuingBank ?? "",
        checkNumber: c.checkNumber ?? "",
        amount: c.amount ?? 0,
        paymentDateISO: c.paymentDate ? c.paymentDate.toISOString() : "",
      }));

    const totalRetenciones =
      (pay.retentionGanancias?.withheldAmount ?? 0) + pay.retentionIIBB + pay.retentionOther;

    return {
      id: pay._id.toString(),
      providerName: providerDoc?.nombre ?? "—",
      paymentDateISO: pay.paymentDate.toISOString(),
      grossAmount: pay.grossAmount,
      regimeCode: pay.regimeCode,
      withheldGanancias: pay.retentionGanancias?.withheldAmount ?? 0,
      retentionIIBB: pay.retentionIIBB,
      retentionOther: pay.retentionOther,
      totalPaid: pay.grossAmount - totalRetenciones,
      invoiceNumbers,
      checksSummary,
      voucherNumber: pay.voucherNumber,
      paymentOrderNumber: pay.paymentOrderNumber,
    };
  });

  const pendingPurchasesCount = await Purchase.countDocuments({ paid: false });
  const emittedChecksCount = await Check.countDocuments({ direction: "EMITIDO" });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Pagos</h1>
        <p className="text-sm text-muted-foreground">
          Pagos a proveedores: saldá facturas de Compras con cheques y calculá la retención de
          Ganancias (RG 830) de una sola vez.
        </p>
      </div>

      <PagosClient
        payments={paymentItems}
        providers={providerOptions}
        regimes={regimeOptions}
        pendingPurchasesCount={pendingPurchasesCount}
        emittedChecksCount={emittedChecksCount}
      />
    </div>
  );
}