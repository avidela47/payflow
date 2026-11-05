import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { getViaticosReport, currentPeriodString } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

// Igual que /imprimir/reportes/compras y el resto: fuera de (dashboard),
// sin sidebar, pensada para Ctrl+P → Guardar como PDF.
export default async function ImprimirReporteViaticosPage({
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
  const report = await getViaticosReport(periodISO);
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
          <p className="text-lg font-bold">REPORTE DE VIAJES</p>
          <p className="text-sm capitalize text-gray-700">{report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Resumen del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Total de viajes</th>
              <th className="p-2 text-right">Excedente de viáticos</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="p-2">
                {formatCurrency(report.totalAmount)} ({report.totalCount})
              </td>
              <td className="p-2 text-right">{formatCurrency(report.totalExcedente)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Por categoría del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Categoría</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.byCategory.map((row) => (
              <tr key={row.categoria} className="border-b border-gray-200">
                <td className="p-2">{row.categoria}</td>
                <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {report.byCategory.length === 0 && (
              <tr>
                <td colSpan={2} className="p-4 text-center text-gray-500">
                  No hay viajes cargados en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Por forma de pago (honorarios, materiales y extras)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Forma de pago</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.byPaymentMode.map((row) => (
              <tr key={row.paymentMode} className="border-b border-gray-200">
                <td className="p-2">{row.paymentMode}</td>
                <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {report.byPaymentMode.length === 0 && (
              <tr>
                <td colSpan={2} className="p-4 text-center text-gray-500">
                  No hay gastos de empleados, materiales o extras cargados en este mes.
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
              <th className="p-2">Viaje</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Paga</th>
              <th className="p-2 text-right">Monto</th>
              <th className="p-2 text-right">Excedente</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200">
                <td className="p-2">{entry.nombre}</td>
                <td className="p-2">{formatDate(entry.fechaISO)}</td>
                <td className="p-2">{entry.paidBy ?? "—"}</td>
                <td className="p-2 text-right">{formatCurrency(entry.totalAmount)}</td>
                <td className="p-2 text-right">
                  {entry.excedente > 0 ? formatCurrency(entry.excedente) : "—"}
                </td>
              </tr>
            ))}
            {report.detail.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No hay viajes cargados en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}