import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Proyecto } from "@/models/Proyecto";
import { ProyectosClient, type ProyectoListItem } from "./proyectos-client";

export default async function ProyectosPage() {
  await requireModuleAccess("proyectos");
  await connectDB();

  const proyectos = await Proyecto.find({}).sort({ createdAt: -1 }).lean();

  const items: ProyectoListItem[] = proyectos.map((p) => ({
    id: p._id.toString(),
    numero: p.numero,
    cliente: p.cliente,
    nombre: p.nombre,
    prioridad: p.prioridad,
    estado: p.estado,
    items: p.items.map((it) => ({
      modelo: it.modelo,
      cantidadSolicitada: it.cantidadSolicitada,
      cantidadCompletada: it.cantidadCompletada,
    })),
    numeroOrdenTrabajo: p.numeroOrdenTrabajo,
    createdAtISO: p.createdAt.toISOString().slice(0, 10),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Proyectos de fábrica</h1>
        <p className="text-sm text-muted-foreground">
          Se generan automáticamente al ejecutar una Orden de Trabajo que necesita fabricar algo, o
          se crean a mano para adelantarse a la demanda. El taller los trabaja desde la pantalla de
          fábrica.
        </p>
      </div>
      <ProyectosClient items={items} />
    </div>
  );
}
