import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Despacho } from "@/models/Despacho";
import { luminariaOrigenLabel } from "@/lib/luminaria-origen";
import { despachoEstadoLabel } from "@/lib/despacho-estados";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Igual criterio que /imprimir/presupuestos/[id] y /imprimir/remitos/[id]:
// fuera de (dashboard), sin sidebar, encabezado de ITELSA (COMPANY). Los
// renglones de firma ("Firma recepción" / "Firma ITELSA") son los que
// usa de verdad la vista de impresión del Despacho original — a
// diferencia de los que se agregaron sin confirmar en /imprimir/remitos.
export default async function ImprimirDespachoPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("despachos");
  await connectDB();

  const despacho = await Despacho.findById(params.id).lean();

  if (!despacho) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Despacho no encontrado.</p>
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
          <p className="text-lg font-bold">DESPACHO</p>
          <p className="text-sm text-gray-700">N° {despacho.numero}</p>
          <p className="text-xs text-gray-500">{new Date(despacho.fecha).toLocaleDateString("es-AR")}</p>
          <p className="text-xs text-gray-500">Estado: {despachoEstadoLabel(despacho.estado)}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6 text-sm">
        <p className="font-semibold">{despacho.razonSocial}</p>
        {despacho.numeroPresupuesto && (
          <p className="mt-1 text-xs text-gray-600">Presupuesto: {despacho.numeroPresupuesto}</p>
        )}
      </section>

      <section className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Código</th>
              <th className="p-2">Descripción</th>
              <th className="p-2 text-center">Origen</th>
              <th className="p-2 text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {despacho.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2">{item.codigo}</td>
                <td className="p-2">{item.descripcion}</td>
                <td className="p-2 text-center text-xs text-gray-600">
                  {luminariaOrigenLabel(item.origen)}
                </td>
                <td className="p-2 text-right">{item.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {despacho.observaciones && (
        <section className="mt-6 text-xs text-gray-600">
          <p>{despacho.observaciones}</p>
        </section>
      )}

      <section className="mt-12 grid grid-cols-2 gap-8 text-xs text-gray-600">
        <div className="border-t border-gray-400 pt-2 text-center">Firma recepción</div>
        <div className="border-t border-gray-400 pt-2 text-center">Firma ITELSA</div>
      </section>
    </div>
  );
}