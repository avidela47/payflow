import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Recibo } from "@/models/Recibo";
import { reciboEstadoLabel, formaPagoLabel } from "@/lib/recibo-estados";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Igual criterio que /imprimir/presupuestos, /imprimir/remitos y
// /imprimir/despachos: fuera de (dashboard), sin sidebar, encabezado de
// ITELSA (COMPANY). A diferencia de esos tres, el original de Recibo usa
// una sola línea de firma genérica ("Firma: ___"), no dos columnas — se
// mantiene así porque es lo que realmente imprime el original (no se
// inventa una firma "del cliente"/"de ITELSA" que el original no tiene).
export default async function ImprimirReciboPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("recibos");
  await connectDB();

  const recibo = await Recibo.findById(params.id).lean();

  if (!recibo) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Recibo no encontrado.</p>
      </div>
    );
  }

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
          <p className="text-lg font-bold">RECIBO</p>
          <p className="text-sm text-gray-700">N° {recibo.numero}</p>
          <p className="text-xs text-gray-500">{new Date(recibo.fecha).toLocaleDateString("es-AR")}</p>
          <p className="text-xs text-gray-500">Estado: {reciboEstadoLabel(recibo.estado)}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500">CLIENTE</p>
          <p className="font-semibold">{recibo.razonSocial}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">REFERENCIA</p>
          {recibo.numeroPresupuesto && <p className="text-xs">Presupuesto: {recibo.numeroPresupuesto}</p>}
          {recibo.numeroOrden && <p className="text-xs">Orden de trabajo: {recibo.numeroOrden}</p>}
          {!recibo.numeroPresupuesto && !recibo.numeroOrden && <p className="text-xs text-gray-500">—</p>}
        </div>
      </section>

      <section className="mt-6 rounded-md bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-500">CONCEPTO</p>
        <p className="mt-1 text-sm font-semibold">{recibo.concepto}</p>
        {recibo.lineas.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-1 text-xs font-semibold text-gray-500">Descripción</th>
                <th className="py-1 text-right text-xs font-semibold text-gray-500">Monto U$S</th>
              </tr>
            </thead>
            <tbody>
              {recibo.lineas.map((l, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5">{l.descripcion}</td>
                  <td className="py-1.5 text-right font-medium">
                    {l.montoUsd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 flex justify-end">
        <div className="w-72 text-sm">
          <div className="flex justify-between border-b border-gray-200 py-2">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold">U$S {recibo.totalUsd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 py-2">
            <span className="text-gray-600">Total pagado:</span>
            <span className="font-bold text-green-700">
              U$S {recibo.totalPagadoUsd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between py-2 text-base font-bold">
            <span>Saldo pendiente:</span>
            <span className={recibo.saldoUsd > 0 ? "text-red-700" : "text-green-700"}>
              U$S {recibo.saldoUsd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </section>

      {recibo.pagos.length > 0 && (
        <section className="mt-6">
          <p className="mb-2 text-xs font-semibold text-gray-500">HISTORIAL DE PAGOS</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-left text-white">
                <th className="p-2">Fecha</th>
                <th className="p-2 text-right">Monto U$S</th>
                <th className="p-2 text-right">T. Cambio</th>
                <th className="p-2 text-right">Monto $</th>
                <th className="p-2">Forma de pago</th>
                <th className="p-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {recibo.pagos.map((p, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="p-2">{new Date(p.fecha).toLocaleDateString("es-AR")}</td>
                  <td className="p-2 text-right font-medium">
                    {p.montoUsd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-right">{p.tipoCambio.toLocaleString("es-AR")}</td>
                  <td className="p-2 text-right font-medium">
                    {p.montoPesos.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-xs">{formaPagoLabel(p.formaPago)}</td>
                  <td className="p-2 text-xs text-gray-600">{p.notas || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {recibo.notas && (
        <section className="mt-6 text-xs text-gray-600">
          <p>
            <b>OBSERVACIONES:</b> {recibo.notas}
          </p>
        </section>
      )}

      <section className="mt-10 text-xs text-gray-600">
        <div className="inline-block border-t border-gray-400 pt-2">Firma: _______________________</div>
      </section>
    </div>
  );
}