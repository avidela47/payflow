import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { getPayrollReport, currentPeriodString } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Ruta fuera de (dashboard) a propósito: sin sidebar, layout mínimo,
// pensada para imprimir o exportar a PDF desde el navegador (Ctrl+P →
// Guardar como PDF).
export default async function ImprimirReporteSueldosPage({
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
  const report = await getPayrollReport(periodISO);
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
          <p className="text-lg font-bold">REPORTE DE SUELDOS</p>
          <p className="text-sm capitalize text-gray-700">{report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="bg-gray-900 text-left text-white">
            <th className="p-2">Empleado</th>
            <th className="p-2 text-right">Monotributo</th>
            <th className="p-2 text-right">Registrado</th>
            <th className="p-2 text-right">Informal / Viáticos</th>
            <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.employeeId} className="border-b border-gray-200">
              <td className="p-2">{row.employeeName}</td>
              <td className="p-2 text-right">
                {row.monotributo > 0 ? formatCurrency(row.monotributo) : "—"}
              </td>
              <td className="p-2 text-right">
                {row.registrado > 0 ? formatCurrency(row.registrado) : "—"}
              </td>
              <td className="p-2 text-right">
                {row.informal > 0 ? formatCurrency(row.informal) : "—"}
              </td>
              <td className="p-2 text-right font-medium">{formatCurrency(row.total)}</td>
            </tr>
          ))}
          {report.rows.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">
                No hay liquidaciones cargadas para este período.
              </td>
            </tr>
          )}
        </tbody>
        {report.rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-gray-900 font-semibold">
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{formatCurrency(report.totals.monotributo)}</td>
              <td className="p-2 text-right">{formatCurrency(report.totals.registrado)}</td>
              <td className="p-2 text-right">{formatCurrency(report.totals.informal)}</td>
              <td className="p-2 text-right">{formatCurrency(report.totals.total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}