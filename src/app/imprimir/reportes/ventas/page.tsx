import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { getSalesReport, currentPeriodString } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

function channelLabel(channel: "OFICINA" | "MERCADO_LIBRE"): string {
  return channel === "MERCADO_LIBRE" ? "Mercado Libre" : "Oficina";
}

// Igual que /imprimir/reportes/sueldos y /gastos: fuera de (dashboard),
// sin sidebar, pensada para Ctrl+P → Guardar como PDF.
export default async function ImprimirReporteVentasPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("reportes");

  const periodISO = searchParams.period || currentPeriodString();
  const report = await getSalesReport(periodISO);
  const emittedAt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const hasChannelData =
    report.channelBreakdown.mercadoLibre.count > 0 || report.channelBreakdown.oficina.count > 0;

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
          <p className="text-lg font-bold">REPORTE DE VENTAS</p>
          <p className="text-sm capitalize text-gray-700">{report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Resumen del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Total de ventas</th>
              <th className="p-2 text-right">Cobradas</th>
              <th className="p-2 text-right">Falta por cobrar</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="p-2">
                {formatCurrency(report.totalAmount)} ({report.totalCount})
              </td>
              <td className="p-2 text-right">
                {formatCurrency(report.collectedAmount)} ({report.collectedCount})
              </td>
              <td className="p-2 text-right">
                {formatCurrency(report.pendingAmount)} ({report.pendingCount})
              </td>
            </tr>
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
                  No hay ventas cargadas en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {hasChannelData && (
        <section className="mt-8">
          <p className="mb-2 text-sm font-semibold">Desglose por canal</p>
          <div className="grid grid-cols-2 gap-6">
            {report.channelBreakdown.mercadoLibre.count > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-left text-white">
                    <th className="p-2" colSpan={2}>
                      Mercado Libre ({report.channelBreakdown.mercadoLibre.count})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2">Bruto</td>
                    <td className="p-2 text-right">
                      {formatCurrency(report.channelBreakdown.mercadoLibre.grossAmount)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2">Comisión ML</td>
                    <td className="p-2 text-right">
                      {formatCurrency(report.channelBreakdown.mercadoLibre.totalCommission)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2">Envío</td>
                    <td className="p-2 text-right">
                      {formatCurrency(report.channelBreakdown.mercadoLibre.totalShipping)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2">Impuestos</td>
                    <td className="p-2 text-right">
                      {formatCurrency(report.channelBreakdown.mercadoLibre.totalTaxes)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 font-semibold">
                    <td className="p-2">Precio neto real</td>
                    <td className="p-2 text-right">
                      {formatCurrency(report.channelBreakdown.mercadoLibre.netAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {report.channelBreakdown.oficina.count > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-left text-white">
                    <th className="p-2" colSpan={2}>
                      Oficina ({report.channelBreakdown.oficina.count})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-2">Bruto</td>
                    <td className="p-2 text-right">
                      {formatCurrency(report.channelBreakdown.oficina.grossAmount)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 font-semibold">
                    <td className="p-2">Costo neto</td>
                    <td className="p-2 text-right">
                      {formatCurrency(report.channelBreakdown.oficina.netCostAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Detalle cronológico</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Cliente</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Forma de pago</th>
              <th className="p-2">Canal</th>
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200">
                <td className="p-2">{entry.clientName}</td>
                <td className="p-2">{entry.saleDateISO}</td>
                <td className="p-2">{entry.paymentMethod ?? "—"}</td>
                <td className="p-2">{channelLabel(entry.channel)}</td>
                <td className="p-2">{entry.collected ? "Cobrada" : "Pendiente"}</td>
                <td className="p-2 text-right">{formatCurrency(entry.amount)}</td>
              </tr>
            ))}
            {report.detail.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay ventas cargadas en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}