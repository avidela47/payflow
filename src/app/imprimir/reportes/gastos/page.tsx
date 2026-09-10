import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFixedCostReport, currentPeriodString, periodStringToDate } from "@/lib/reports";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Igual que /imprimir/reportes/sueldos: fuera de (dashboard), sin sidebar,
// pensada para Ctrl+P → Guardar como PDF.
export default async function ImprimirReporteGastosPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const current = currentPeriodString();
  const fromISO = searchParams.from || current;
  const toISO = searchParams.to || current;
  const report = await getFixedCostReport(fromISO, toISO);
  const emittedAt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const rangeLabel = `${formatPeriod(periodStringToDate(report.fromISO))} a ${formatPeriod(
    periodStringToDate(report.toISO)
  )}`;

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
          <p className="text-lg font-bold">REPORTE DE GASTOS</p>
          <p className="text-sm capitalize text-gray-700">{rangeLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Resumen por categoría</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Categoría</th>
              {report.months.map((m) => (
                <th key={m} className="whitespace-nowrap p-2 text-right capitalize">
                  {formatPeriod(periodStringToDate(m))}
                </th>
              ))}
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {report.summary.map((row) => (
              <tr key={row.categoryId} className="border-b border-gray-200">
                <td className="p-2">{row.categoryName}</td>
                {report.months.map((m) => (
                  <td key={m} className="p-2 text-right">
                    {row.amountsByPeriod[m] ? formatCurrency(row.amountsByPeriod[m]) : "—"}
                  </td>
                ))}
                <td className="p-2 text-right font-medium">{formatCurrency(row.total)}</td>
              </tr>
            ))}
            {report.summary.length === 0 && (
              <tr>
                <td colSpan={report.months.length + 2} className="p-4 text-center text-gray-500">
                  No hay gastos cargados en este rango.
                </td>
              </tr>
            )}
          </tbody>
          {report.summary.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-900 font-semibold">
                <td className="p-2">Total</td>
                {report.months.map((m) => (
                  <td key={m} className="p-2 text-right">
                    {formatCurrency(report.summaryTotalsByPeriod[m] ?? 0)}
                  </td>
                ))}
                <td className="p-2 text-right">{formatCurrency(report.grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Detalle cronológico</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Categoría</th>
              <th className="p-2">Período</th>
              <th className="p-2">Forma de pago</th>
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200">
                <td className="p-2">{entry.categoryName}</td>
                <td className="p-2 capitalize">{entry.periodLabel}</td>
                <td className="p-2">{entry.paymentMode ?? "—"}</td>
                <td className="p-2">{entry.paid ? "Pagado" : "Pendiente"}</td>
                <td className="p-2 text-right">{formatCurrency(entry.amount)}</td>
              </tr>
            ))}
            {report.detail.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No hay gastos cargados en este rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}