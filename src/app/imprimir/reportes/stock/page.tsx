import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { getStockReport, currentPeriodString } from "@/lib/reports";
import { luminariaOrigenLabel } from "@/lib/luminaria-origen";
import { movimientoComponenteTipoLabel } from "@/lib/movimiento-componente-tipos";
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
export default async function ImprimirReporteStockPage({
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
  const report = await getStockReport(periodISO);
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
          <p className="text-lg font-bold">REPORTE DE STOCK</p>
          <p className="text-sm capitalize text-gray-700">Movimientos: {report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Valorización actual</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Componentes</th>
              <th className="p-2 text-right">Luminarias</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="p-2">
                U$D {formatUsd(report.componentes.valorizacionTotalUsd)} ({report.componentes.totalCount}{" "}
                código(s), {report.componentes.bajoMinimo.length} bajo mínimo)
              </td>
              <td className="p-2 text-right">
                U$D {formatUsd(report.luminarias.valorizacionTotalUsd)} ({report.luminarias.totalCount}{" "}
                código(s), {report.luminarias.bajoMinimo.length} bajo mínimo)
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Componentes bajo stock mínimo</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Código</th>
              <th className="p-2">Descripción</th>
              <th className="p-2 text-right">Actual</th>
              <th className="p-2 text-right">Mínimo</th>
              <th className="p-2 text-right">Valorización</th>
            </tr>
          </thead>
          <tbody>
            {report.componentes.bajoMinimo.map((row) => (
              <tr key={row.id} className="border-b border-gray-200">
                <td className="p-2">{row.codigo}</td>
                <td className="p-2">{row.descripcion}</td>
                <td className="p-2 text-right">{row.stockActual}</td>
                <td className="p-2 text-right">{row.stockMinimo}</td>
                <td className="p-2 text-right">U$D {formatUsd(row.valorizacionUsd)}</td>
              </tr>
            ))}
            {report.componentes.bajoMinimo.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  Ningún componente está bajo su stock mínimo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Luminarias bajo stock mínimo</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Código</th>
              <th className="p-2">Descripción</th>
              <th className="p-2">Origen</th>
              <th className="p-2 text-right">Actual</th>
              <th className="p-2 text-right">Mínimo</th>
              <th className="p-2 text-right">Valorización</th>
            </tr>
          </thead>
          <tbody>
            {report.luminarias.bajoMinimo.map((row) => (
              <tr key={row.id} className="border-b border-gray-200">
                <td className="p-2">{row.codigo}</td>
                <td className="p-2">{row.descripcion}</td>
                <td className="p-2">{luminariaOrigenLabel(row.origen)}</td>
                <td className="p-2 text-right">{row.stockActual}</td>
                <td className="p-2 text-right">{row.stockMinimo}</td>
                <td className="p-2 text-right">U$D {formatUsd(row.valorizacionUsd)}</td>
              </tr>
            ))}
            {report.luminarias.bajoMinimo.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  Ninguna luminaria está bajo su stock mínimo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Movimientos de Componentes del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Fecha</th>
              <th className="p-2">Código</th>
              <th className="p-2">Descripción</th>
              <th className="p-2">Tipo</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">Stock res.</th>
              <th className="p-2">Referencia</th>
            </tr>
          </thead>
          <tbody>
            {report.movimientos.map((m) => (
              <tr key={m.id} className="border-b border-gray-200">
                <td className="p-2">{m.fechaISO}</td>
                <td className="p-2">{m.codigoComponente}</td>
                <td className="p-2">{m.descripcionComponente}</td>
                <td className="p-2">{movimientoComponenteTipoLabel(m.tipo)}</td>
                <td className="p-2 text-right">{m.cantidad}</td>
                <td className="p-2 text-right">{m.stockResultante}</td>
                <td className="p-2">{m.referencia || "—"}</td>
              </tr>
            ))}
            {report.movimientos.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Sin movimientos de Componentes en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
