import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPurchasesReport, currentPeriodString } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";
import type { PurchaseReceiptStatus } from "@/models/Purchase";

const RECEIPT_STATUS_LABELS: Record<PurchaseReceiptStatus, string> = {
  EN_CURSO: "En curso",
  RECIBIDA_PARCIAL: "Recibida parcial",
  RECIBIDA_TOTAL: "Recibida total",
};

// Igual que /imprimir/reportes/ventas y /sueldos: fuera de (dashboard),
// sin sidebar, pensada para Ctrl+P → Guardar como PDF.
export default async function ImprimirReporteComprasPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getPurchasesReport(periodISO);
  const emittedAt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b-2 border-primary pb-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={COMPANY.logoUrl} alt={COMPANY.name} className="h-14 w-14 object-contain" />
          <div>
            <p className="text-lg font-bold text-primary">{COMPANY.name}</p>
            <p className="text-xs text-gray-600">{COMPANY.address}</p>
            <p className="text-xs text-gray-600">Tel: {COMPANY.phone}</p>
            <p className="text-xs text-gray-600">CUIT: {COMPANY.cuit}</p>
            <p className="text-xs text-gray-600">{COMPANY.taxStatus}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">REPORTE DE COMPRAS</p>
          <p className="text-sm capitalize text-gray-700">{report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Resumen del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Total de compras</th>
              <th className="p-2 text-right">Pagadas</th>
              <th className="p-2 text-right">Falta por pagar</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="p-2">
                {formatCurrency(report.totalAmount)} ({report.totalCount})
              </td>
              <td className="p-2 text-right">
                {formatCurrency(report.paidAmount)} ({report.paidCount})
              </td>
              <td className="p-2 text-right">
                {formatCurrency(report.pendingAmount)} ({report.pendingCount})
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Estado de recepción del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.byReceiptStatus.map((row) => (
              <tr key={row.status} className="border-b border-gray-200">
                <td className="p-2">{RECEIPT_STATUS_LABELS[row.status]}</td>
                <td className="p-2 text-right">{row.count}</td>
                <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {report.byReceiptStatus.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  No hay compras cargadas en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Formas de pago del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Forma de pago</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.byPaymentMethod.map((row) => (
              <tr key={row.method} className="border-b border-gray-200">
                <td className="p-2">{row.method}</td>
                <td className="p-2 text-right">{row.count}</td>
                <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {report.byPaymentMethod.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  No hay compras cargadas en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Detalle cronológico</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Proveedor</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Forma de pago</th>
              <th className="p-2">Recepción</th>
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200">
                <td className="p-2">{entry.providerName}</td>
                <td className="p-2">{entry.purchaseDateISO}</td>
                <td className="p-2">{entry.paymentMethod ?? "—"}</td>
                <td className="p-2">{RECEIPT_STATUS_LABELS[entry.receiptStatus]}</td>
                <td className="p-2">{entry.paid ? "Pagada" : "Pendiente"}</td>
                <td className="p-2 text-right">{formatCurrency(entry.amount)}</td>
              </tr>
            ))}
            {report.detail.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay compras cargadas en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}