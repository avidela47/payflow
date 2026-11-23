import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import { Proyecto } from "@/models/Proyecto";
import { OrdenDetalleClient, type OrdenDetalle, type ProyectoResumen } from "./orden-detalle-client";

export default async function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("ordenes");
  await connectDB();

  const { id } = await params;
  const orden = await OrdenTrabajo.findById(id).lean();
  if (!orden) notFound();

  // Fix respecto del original: el link al Proyecto de fábrica generado se
  // lee siempre de orden.proyectoFabricaId (persistido en la OT), no de un
  // resultado efímero de la acción "ejecutar" — así sigue visible aunque
  // se recargue la página o se vuelva más tarde (el original perdía este
  // link al recargar /ordenes/[id]).
  let proyecto: ProyectoResumen | null = null;
  if (orden.proyectoFabricaId) {
    const p = await Proyecto.findById(orden.proyectoFabricaId).lean();
    if (p) {
      proyecto = {
        id: p._id.toString(),
        numero: p.numero,
        estado: p.estado,
      };
    }
  }

  const detalle: OrdenDetalle = {
    id: orden._id.toString(),
    numero: orden.numero,
    fechaISO: orden.fecha.toISOString().slice(0, 10),
    fechaEntregaISO: orden.fechaEntrega?.toISOString().slice(0, 10),
    razonSocial: orden.razonSocial,
    numeroPresupuesto: orden.numeroPresupuesto,
    vendedor: orden.vendedor,
    lineas: orden.lineas.map((l) => ({
      codigoLuminaria: l.codigoLuminaria,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
    })),
    estado: orden.estado,
    ejecutada: orden.ejecutada,
    fechaEjecucionISO: orden.fechaEjecucion?.toISOString().slice(0, 10),
    itemsDescontados: orden.itemsDescontados.map((i) => ({
      codigo: i.codigo,
      origen: i.origen,
      cantidad: i.cantidad,
    })),
    notas: orden.notas,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Orden de trabajo {detalle.numero}</h1>
        <p className="text-sm text-muted-foreground">{detalle.razonSocial}</p>
      </div>
      <OrdenDetalleClient orden={detalle} proyecto={proyecto} />
    </div>
  );
}
