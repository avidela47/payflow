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
              <th className="p-2">Fechas</th>
              <th className="p-2">Paga</th>
              <th className="p-2 text-right">Monto</th>
              <th className="p-2 text-right">Excedente</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200">
                <td className="p-2">{entry.nombre}</td>
                <td className="p-2">
                  {entry.fechaInicioISO === entry.fechaFinISO
                    ? formatDate(entry.fechaInicioISO)
                    : `${formatDate(entry.fechaInicioISO)} – ${formatDate(entry.fechaFinISO)}`}
                </td>
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

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Detalle completo por viaje</p>
        {report.viajes.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-500">No hay viajes cargados en este mes.</p>
        )}
        <div className="flex flex-col gap-4">
          {report.viajes.map((v) => (
            <div key={v.id} className="break-inside-avoid rounded border border-gray-300 p-3">
              <div className="mb-2 flex items-center justify-between border-b border-gray-300 pb-2">
                <div>
                  <p className="font-semibold">{v.nombre}</p>
                  <p className="text-xs text-gray-600">
                    {v.fechaInicioISO === v.fechaFinISO
                      ? formatDate(v.fechaInicioISO)
                      : `${formatDate(v.fechaInicioISO)} – ${formatDate(v.fechaFinISO)}`}
                    {v.paidBy ? ` · Paga: ${v.paidBy}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(v.totalAmount)}</p>
                  {v.excedente > 0 && (
                    <p className="text-xs text-gray-600">Excedente: {formatCurrency(v.excedente)}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                {v.empleados.length > 0 && (
                  <div className="rounded bg-blue-50 p-2">
                    <p className="mb-1 font-semibold text-gray-700">Empleados</p>
                    <ul className="list-disc pl-4">
                      {v.empleados.map((e, i) => (
                        <li key={i}>
                          {e.employeeName} —{" "}
                          {e.honorarioType === "DIA"
                            ? `${formatCurrency(e.monto)}/día x ${e.dias ?? 1} día(s)`
                            : formatCurrency(e.monto)}
                          {" = "}
                          {formatCurrency(e.montoTotal)}
                          {e.paymentMode ? ` (${e.paymentMode})` : ""}
                          {" — "}
                          {e.saldo <= 0 ? "Completado" : `Saldo: ${formatCurrency(e.saldo)}`}
                          {e.pagos.length > 0 &&
                            ` (pagos: ${e.pagos
                              .map((p) => `${formatDate(p.fechaISO)} ${formatCurrency(p.monto)}`)
                              .join(", ")})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.topesDiarios.length > 0 && (
                  <div className="rounded bg-amber-50 p-2">
                    <p className="mb-1 font-semibold text-gray-700">Tope diario de viático</p>
                    <ul className="list-disc pl-4">
                      {v.topesDiarios.map((t, i) => (
                        <li key={i}>
                          {t.employeeName} — importe {formatCurrency(t.monto)}/día —{" "}
                          {t.saldo < 0 ? `Excedido en ${formatCurrency(Math.abs(t.saldo))}` : `Saldo: ${formatCurrency(t.saldo)}`}
                          {t.gastos.length > 0 &&
                            ` (gastos: ${t.gastos
                              .map(
                                (g) =>
                                  `${g.descripcion} ${formatCurrency(g.monto)}${
                                    g.paymentMode ? ` (${g.paymentMode})` : ""
                                  }`
                              )
                              .join(", ")})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.hospedaje && (v.hospedaje.lugar || v.hospedaje.total > 0) && (
                  <div className="rounded bg-emerald-50 p-2">
                    <p className="mb-1 font-semibold text-gray-700">Hospedaje</p>
                    <p>
                      {v.hospedaje.lugar ?? "—"}
                      {v.hospedaje.checkInISO ? ` (${formatDate(v.hospedaje.checkInISO)}` : ""}
                      {v.hospedaje.checkOutISO ? ` – ${formatDate(v.hospedaje.checkOutISO)})` : v.hospedaje.checkInISO ? ")" : ""}
                      {" — "}
                      {formatCurrency(v.hospedaje.costoPorDia ?? 0)}/día x {v.hospedaje.cantidadDias ?? 0} día(s) ={" "}
                      {formatCurrency(v.hospedaje.total)}
                      {v.hospedaje.paidBy ? ` — paga ${v.hospedaje.paidBy}` : ""}
                    </p>
                  </div>
                )}

                {v.combustible && v.combustible.monto ? (
                  <div className="rounded bg-orange-50 p-2">
                    <p className="mb-1 font-semibold text-gray-700">Combustible (EdenRed)</p>
                    <p>
                      {formatCurrency(v.combustible.monto)}
                      {v.combustible.paidBy ? ` — paga ${v.combustible.paidBy}` : ""}
                    </p>
                  </div>
                ) : null}

                {v.extras.length > 0 && (
                  <div className="rounded bg-purple-50 p-2">
                    <p className="mb-1 font-semibold text-gray-700">Extras</p>
                    <ul className="list-disc pl-4">
                      {v.extras.map((x, i) => (
                        <li key={i}>
                          {x.descripcion} — {formatCurrency(x.monto)}
                          {x.paymentMode ? ` (${x.paymentMode})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.materiales.length > 0 && (
                  <div className="rounded bg-cyan-50 p-2">
                    <p className="mb-1 font-semibold text-gray-700">Materiales</p>
                    <ul className="list-disc pl-4">
                      {v.materiales.map((m, i) => (
                        <li key={i}>
                          {m.descripcion} {m.cantidad ? `x${m.cantidad}` : ""} — {formatCurrency(m.monto)}
                          {m.paymentMode ? ` (${m.paymentMode})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {v.seguro && v.seguro.compania && (
                  <div className="rounded bg-rose-50 p-2">
                    <p className="mb-1 font-semibold text-gray-700">Seguro</p>
                    <p>
                      {v.seguro.compania} — {v.seguro.cobertura} ({v.seguro.cantidadDias ?? 0} día(s),{" "}
                      {formatCurrency(v.seguro.costo ?? 0)})
                    </p>
                  </div>
                )}

                {v.notes && <p className="text-gray-600">Notas: {v.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}