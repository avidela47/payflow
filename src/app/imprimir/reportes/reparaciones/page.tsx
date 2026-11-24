import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { getReparacionesReport, currentPeriodString } from "@/lib/reports";
import { reparacionEstadoLabel } from "@/lib/reparacion-estados";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Igual criterio que /imprimir/reportes/ventas y el resto: fuera de
// (dashboard), sin sidebar, pensada para Ctrl+P → Guardar como PDF.
export default async function ImprimirReporteReparacionesPage({
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
  const report = await getReparacionesReport(periodISO);
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
          <img src={COMPANY.logoUrl} alt={COMPANY.name} className="h-16 w-auto object-contain" />
          <div>
            <p className="text-xs text-gray-600">{COMPANY.address}</p>
            <p className="text-xs text-gray-600">Tel: {COMPANY.phone}</p>
            <p className="text-xs text-gray-600">CUIT: {COMPANY.cuit}</p>
            <p className="text-xs text-gray-600">{COMPANY.taxStatus}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">REPORTE DE REPARACIONES</p>
          <p className="text-sm capitalize text-gray-700">{report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Resumen del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Cargadas</th>
              <th className="p-2 text-right">Ejecutadas (Listas)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="p-2">{report.creadasCount}</td>
              <td className="p-2 text-right">{report.ejecutadasCount}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-2 gap-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-left text-white">
                <th className="p-2" colSpan={2}>
                  Por estado
                </th>
              </tr>
            </thead>
            <tbody>
              {report.byEstado.map((row) => (
                <tr key={row.estado} className="border-b border-gray-200">
                  <td className="p-2">{reparacionEstadoLabel(row.estado)}</td>
                  <td className="p-2 text-right">{row.count}</td>
                </tr>
              ))}
              {report.byEstado.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-gray-500">
                    Sin reparaciones en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-left text-white">
                <th className="p-2" colSpan={3}>
                  Componentes descontados
                </th>
              </tr>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">Código</th>
                <th className="p-2">Descripción</th>
                <th className="p-2 text-right">Cant.</th>
              </tr>
            </thead>
            <tbody>
              {report.componentesDescontados.map((row) => (
                <tr key={row.codigoComponente} className="border-b border-gray-200">
                  <td className="p-2">{row.codigoComponente}</td>
                  <td className="p-2">{row.descripcionComponente}</td>
                  <td className="p-2 text-right">{row.cantidad}</td>
                </tr>
              ))}
              {report.componentesDescontados.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    Sin componentes descontados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Detalle cronológico</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">N°</th>
              <th className="p-2">Razón social</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Tomada por</th>
              <th className="p-2">Ejecutada</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200">
                <td className="p-2">{entry.numero}</td>
                <td className="p-2">{entry.razonSocial}</td>
                <td className="p-2">{entry.fechaISO}</td>
                <td className="p-2">{reparacionEstadoLabel(entry.estado)}</td>
                <td className="p-2">{entry.tomadoPor || "—"}</td>
                <td className="p-2">{entry.fechaEjecucionISO ?? "—"}</td>
              </tr>
            ))}
            {report.detail.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay reparaciones en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
