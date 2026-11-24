import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { getComercialPlantaReport, currentPeriodString } from "@/lib/reports";
import { presupuestoEstadoLabel } from "@/lib/presupuesto-estados";
import { despachoEstadoLabel } from "@/lib/despacho-estados";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Igual criterio que /imprimir/reportes/ventas y el resto: fuera de
// (dashboard), sin sidebar, pensada para Ctrl+P → Guardar como PDF.
export default async function ImprimirReporteComercialPlantaPage({
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
  const report = await getComercialPlantaReport(periodISO);
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
          <p className="text-lg font-bold">REPORTE DE COMERCIAL PLANTA</p>
          <p className="text-sm capitalize text-gray-700">{report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Resumen del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Presupuestos</th>
              <th className="p-2 text-right">Despachos</th>
              <th className="p-2 text-right">Recibos</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="p-2">
                U$D {formatUsd(report.presupuestos.totalUsd)} ({report.presupuestos.totalCount})
              </td>
              <td className="p-2 text-right">
                U$D {formatUsd(report.despachos.montoUsd)} ({report.despachos.totalCount})
              </td>
              <td className="p-2 text-right">
                U$D {formatUsd(report.recibos.totalUsd)} (cobrado U$D{" "}
                {formatUsd(report.recibos.totalCobradoUsd)})
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-2 gap-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-left text-white">
                <th className="p-2" colSpan={3}>
                  Presupuestos por estado
                </th>
              </tr>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">Estado</th>
                <th className="p-2 text-right">Cant.</th>
                <th className="p-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {report.presupuestos.byEstado.map((row) => (
                <tr key={row.estado} className="border-b border-gray-200">
                  <td className="p-2">{presupuestoEstadoLabel(row.estado)}</td>
                  <td className="p-2 text-right">{row.count}</td>
                  <td className="p-2 text-right">U$D {formatUsd(row.totalUsd)}</td>
                </tr>
              ))}
              {report.presupuestos.byEstado.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    Sin presupuestos en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-left text-white">
                <th className="p-2" colSpan={2}>
                  Despachos por estado
                </th>
              </tr>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">Estado</th>
                <th className="p-2 text-right">Cant.</th>
              </tr>
            </thead>
            <tbody>
              {report.despachos.byEstado.map((row) => (
                <tr key={row.estado} className="border-b border-gray-200">
                  <td className="p-2">{despachoEstadoLabel(row.estado)}</td>
                  <td className="p-2 text-right">{row.count}</td>
                </tr>
              ))}
              {report.despachos.byEstado.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-gray-500">
                    Sin despachos en este mes.
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
              <th className="p-2">Tipo</th>
              <th className="p-2">N°</th>
              <th className="p-2">Razón social</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={`${entry.tipo}-${entry.id}`} className="border-b border-gray-200">
                <td className="p-2">{entry.tipo}</td>
                <td className="p-2">{entry.numero}</td>
                <td className="p-2">{entry.razonSocial}</td>
                <td className="p-2">{entry.fechaISO}</td>
                <td className="p-2">{entry.estado}</td>
                <td className="p-2 text-right">
                  {entry.montoUsd !== undefined ? `U$D ${formatUsd(entry.montoUsd)}` : "—"}
                </td>
              </tr>
            ))}
            {report.detail.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay movimientos en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
