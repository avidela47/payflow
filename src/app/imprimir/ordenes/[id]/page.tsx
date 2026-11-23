import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import { ordenTrabajoEstadoLabel } from "@/lib/orden-trabajo-estados";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Mismo criterio que /imprimir/despachos/[id]: fuera de (dashboard), sin
// sidebar, encabezado de ITELSA (COMPANY). El original mostraba esta
// vista inline dentro de /ordenes/[id] mismo — PayFlow lo separa en su
// propia ruta /imprimir, igual que el resto de los documentos.
export default async function ImprimirOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("ordenes");
  await connectDB();

  const { id } = await params;
  const orden = await OrdenTrabajo.findById(id).lean();

  if (!orden) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Orden de trabajo no encontrada.</p>
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
          <p className="text-lg font-bold">ORDEN DE TRABAJO</p>
          <p className="text-sm text-gray-700">N° {orden.numero}</p>
          <p className="text-xs text-gray-500">{new Date(orden.fecha).toLocaleDateString("es-AR")}</p>
          <p className="text-xs text-gray-500">Estado: {ordenTrabajoEstadoLabel(orden.estado)}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6 text-sm">
        <p className="font-semibold">{orden.razonSocial}</p>
        {orden.numeroPresupuesto && (
          <p className="mt-1 text-xs text-gray-600">Presupuesto: {orden.numeroPresupuesto}</p>
        )}
        {orden.fechaEntrega && (
          <p className="text-xs text-gray-600">
            Entrega: {new Date(orden.fechaEntrega).toLocaleDateString("es-AR")}
          </p>
        )}
        <p className="text-xs text-gray-600">Vendedor: {orden.vendedor || "—"}</p>
      </section>

      <section className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Código</th>
              <th className="p-2">Descripción</th>
              <th className="p-2 text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {orden.lineas.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2">{l.codigoLuminaria}</td>
                <td className="p-2">{l.descripcion}</td>
                <td className="p-2 text-right">{l.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {orden.notas && (
        <section className="mt-6 text-xs text-gray-600">
          <p>{orden.notas}</p>
        </section>
      )}

      <section className="mt-12 grid grid-cols-2 gap-8 text-xs text-gray-600">
        <div className="border-t border-gray-400 pt-2 text-center">Firma taller</div>
        <div className="border-t border-gray-400 pt-2 text-center">Firma ITELSA</div>
      </section>
    </div>
  );
}
