import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Reparacion } from "@/models/Reparacion";
import { Componente } from "@/models/Componente";
import {
  ReparacionDetalleClient,
  type ReparacionDetalle,
  type ComponenteOption,
} from "./reparacion-detalle-client";

export default async function ReparacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("reparaciones");
  await connectDB();

  const { id } = await params;
  const [reparacion, componentes] = await Promise.all([
    Reparacion.findById(id).lean(),
    Componente.find({}).sort({ codigo: 1 }).lean(),
  ]);
  if (!reparacion) notFound();

  const detalle: ReparacionDetalle = {
    id: reparacion._id.toString(),
    numero: reparacion.numero,
    fechaISO: reparacion.fecha.toISOString().slice(0, 10),
    fechaEntregaISO: reparacion.fechaEntrega?.toISOString().slice(0, 10),
    razonSocial: reparacion.razonSocial,
    numeroPresupuesto: reparacion.numeroPresupuesto,
    vendedor: reparacion.vendedor,
    lineas: reparacion.lineas.map((l) => ({
      codigoLuminaria: l.codigoLuminaria,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
    })),
    estado: reparacion.estado,
    ejecutada: reparacion.ejecutada,
    fechaEjecucionISO: reparacion.fechaEjecucion?.toISOString().slice(0, 10),
    componentesDescontados: reparacion.componentesDescontados.map((c) => ({
      codigoComponente: c.codigoComponente,
      descripcionComponente: c.descripcionComponente,
      cantidad: c.cantidad,
    })),
    notas: reparacion.notas,
  };

  const componenteOptions: ComponenteOption[] = componentes.map((c) => ({
    id: c._id.toString(),
    codigo: c.codigo,
    descripcion: c.descripcion,
    stockActual: c.stockActual,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Reparación {detalle.numero}</h1>
        <p className="text-sm text-muted-foreground">{detalle.razonSocial}</p>
      </div>
      <ReparacionDetalleClient reparacion={detalle} componentes={componenteOptions} />
    </div>
  );
}
