import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Reparacion } from "@/models/Reparacion";
import { reparacionEstadoLabel } from "@/lib/reparacion-estados";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Mismo criterio que /imprimir/ordenes/[id]: fuera de (dashboard), sin
// sidebar, encabezado de ITELSA (COMPANY). Reparación no tiene vista de
// impresión en ningún original porque no existe en Gestión de Luminarias
// — se arma siguiendo la misma convención que el resto de los documentos
// de la fusión.
export default async function ImprimirReparacionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("reparaciones");
  await connectDB();

  const { id } = await params;
  const reparacion = await Reparacion.findById(id).lean();

  if (!reparacion) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Reparación no encontrada.</p>
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
          <p className="text-lg font-bold">ORDEN DE REPARACIÓN</p>
          <p className="text-sm text-gray-700">N° {reparacion.numero}</p>
          <p className="text-xs text-gray-500">{new Date(reparacion.fecha).toLocaleDateString("es-AR")}</p>
          <p className="text-xs text-gray-500">Estado: {reparacionEstadoLabel(reparacion.estado)}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6 text-sm">
        <p className="font-semibold">{reparacion.razonSocial}</p>
        {reparacion.numeroPresupuesto && (
          <p className="mt-1 text-xs text-gray-600">Presupuesto: {reparacion.numeroPresupuesto}</p>
        )}
        {reparacion.fechaEntrega && (
          <p className="text-xs text-gray-600">
            Entrega: {new Date(reparacion.fechaEntrega).toLocaleDateString("es-AR")}
          </p>
        )}
        <p className="text-xs text-gray-600">Vendedor: {reparacion.vendedor || "—"}</p>
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
            {reparacion.lineas.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2">{l.codigoLuminaria || "—"}</td>
                <td className="p-2">{l.descripcion}</td>
                <td className="p-2 text-right">{l.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {reparacion.notas && (
        <section className="mt-6 text-xs text-gray-600">
          <p>{reparacion.notas}</p>
        </section>
      )}

      <section className="mt-12 grid grid-cols-2 gap-8 text-xs text-gray-600">
        <div className="border-t border-gray-400 pt-2 text-center">Firma taller</div>
        <div className="border-t border-gray-400 pt-2 text-center">Firma ITELSA</div>
      </section>
    </div>
  );
}
