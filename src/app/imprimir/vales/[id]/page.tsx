import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Vale } from "@/models/Vale";
import { valeEstadoLabel } from "@/lib/vale-estados";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Igual criterio que /imprimir/despachos/[id] y /imprimir/reparaciones/[id]:
// fuera de (dashboard), sin sidebar, encabezado de ITELSA (COMPANY). Firmas
// "Responsable"/"Emisor", calcadas del original ("Firma responsable" /
// "Firma emisor").
export default async function ImprimirValePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("vales");
  await connectDB();

  const vale = await Vale.findById(params.id).lean();

  if (!vale) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Vale no encontrado.</p>
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
          <p className="text-lg font-bold">VALE INTERNO</p>
          <p className="text-sm text-gray-700">N° {vale.numero}</p>
          <p className="text-xs text-gray-500">{new Date(vale.fechaSalida).toLocaleDateString("es-AR")}</p>
          <p className="text-xs text-gray-500">Estado: {valeEstadoLabel(vale.estado)}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500">RESPONSABLE</p>
          <p className="font-semibold">{vale.responsable}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500">EMITIDO POR</p>
          <p className="font-semibold">{vale.emitidoPor}</p>
        </div>
      </section>

      <section className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Descripción</th>
              <th className="p-2 text-center">Tipo</th>
              <th className="p-2 text-center">Cant. salida</th>
              <th className="p-2 text-center">Cant. devuelta</th>
              <th className="p-2 text-center">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {vale.items.map((item, i) => {
              const diff = item.cantidadSalida - item.cantidadDevuelta;
              return (
                <tr key={i} className="border-b border-gray-200">
                  <td className="p-2">{item.descripcion}</td>
                  <td className="p-2 text-center text-xs text-gray-600">{item.tipo}</td>
                  <td className="p-2 text-center font-medium">{item.cantidadSalida}</td>
                  <td className="p-2 text-center">{item.cantidadDevuelta}</td>
                  <td className="p-2 text-center font-semibold">{diff > 0 ? `-${diff}` : "✓"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {vale.observacionesSalida && (
        <section className="mt-6 text-xs text-gray-600">
          <p>
            <b>Observaciones salida:</b> {vale.observacionesSalida}
          </p>
        </section>
      )}
      {vale.observacionesDevolucion && (
        <section className="mt-2 text-xs text-gray-600">
          <p>
            <b>Observaciones devolución:</b> {vale.observacionesDevolucion}
          </p>
        </section>
      )}

      <section className="mt-12 grid grid-cols-2 gap-8 text-xs text-gray-600">
        <div className="border-t border-gray-400 pt-2 text-center">Firma responsable</div>
        <div className="border-t border-gray-400 pt-2 text-center">Firma emisor</div>
      </section>
    </div>
  );
}
