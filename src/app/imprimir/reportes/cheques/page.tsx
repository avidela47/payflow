import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { getCheckReport, currentPeriodString } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";
import type { CheckStatus, CheckType, CheckDirection } from "@/models/Check";

const STATUS_LABELS: Record<CheckStatus, string> = {
  ACTIVO: "Activo",
  COBRADO: "Cobrado",
  ENDOSADO: "Endosado",
  DEPOSITADO: "Depositado",
  CADUCADO: "Caducado",
  OTRO: "Otro",
};

const TYPE_LABELS: Record<CheckType, string> = {
  ELECTRONICO: "E-cheq",
  FISICO: "Físico",
};

const DIRECTION_LABELS: Record<CheckDirection, string> = {
  RECIBIDO: "Recibido",
  EMITIDO: "Emitido",
};

// Mismo campo de datos (`issuerName`), significado distinto según
// dirección: en RECIBIDO es el librador que nos dio el cheque (emisor);
// en EMITIDO es a quién ITELSA se lo entregó (beneficiario).
const PARTY_LABEL_BY_DIRECTION: Record<CheckDirection, string> = {
  RECIBIDO: "Emisor",
  EMITIDO: "Beneficiario",
};

// Igual que /imprimir/reportes/compras y /ventas: fuera de (dashboard),
// sin sidebar, pensada para Ctrl+P → Guardar como PDF.
export default async function ImprimirReporteChequesPage({
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
  const report = await getCheckReport(periodISO);
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
          <p className="text-lg font-bold">REPORTE DE CHEQUES</p>
          <p className="text-sm capitalize text-gray-700">{report.periodLabel}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="mb-2 text-sm font-semibold">Resumen del mes</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Total de cheques</th>
              <th className="p-2 text-right">Activos</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="p-2">
                {formatCurrency(report.totalAmount)} ({report.totalCount})
              </td>
              <td className="p-2 text-right">
                {formatCurrency(report.byStatus.find((s) => s.status === "ACTIVO")?.amount ?? 0)} (
                {report.byStatus.find((s) => s.status === "ACTIVO")?.count ?? 0})
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Por estado</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.byStatus.map((row) => (
              <tr key={row.status} className="border-b border-gray-200">
                <td className="p-2">{STATUS_LABELS[row.status]}</td>
                <td className="p-2 text-right">{row.count}</td>
                <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {report.byStatus.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  No hay cheques con vencimiento en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Recibidos vs. Emitidos</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Dirección</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.byDirection.map((row) => (
              <tr key={row.direction} className="border-b border-gray-200">
                <td className="p-2">{DIRECTION_LABELS[row.direction]}</td>
                <td className="p-2 text-right">{row.count}</td>
                <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {report.byDirection.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  No hay cheques con vencimiento en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <p className="mb-2 text-sm font-semibold">Por tipo</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Tipo</th>
              <th className="p-2 text-right">Cantidad</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.byType.map((row) => (
              <tr key={row.type} className="border-b border-gray-200">
                <td className="p-2">{TYPE_LABELS[row.type]}</td>
                <td className="p-2 text-right">{row.count}</td>
                <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {report.byType.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  No hay cheques con vencimiento en este mes.
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
              <th className="p-2">Dirección</th>
              <th className="p-2">Emisor / Beneficiario</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">N° cheque</th>
              <th className="p-2">Vencimiento</th>
              <th className="p-2">Estado</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {report.detail.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-200">
                <td className="p-2">{DIRECTION_LABELS[entry.direction]}</td>
                <td className="p-2">
                  {entry.issuerName}{" "}
                  <span className="text-xs text-gray-500">
                    ({PARTY_LABEL_BY_DIRECTION[entry.direction]})
                  </span>
                </td>
                <td className="p-2">{TYPE_LABELS[entry.type]}</td>
                <td className="p-2">{entry.checkNumber}</td>
                <td className="p-2">{entry.paymentDateISO}</td>
                <td className="p-2">{STATUS_LABELS[entry.status]}</td>
                <td className="p-2 text-right">{formatCurrency(entry.amount)}</td>
              </tr>
            ))}
            {report.detail.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No hay cheques con vencimiento en este mes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}