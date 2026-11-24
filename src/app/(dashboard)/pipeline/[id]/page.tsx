import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Employee } from "@/models/Employee";
import { PipelineProyecto } from "@/models/PipelineProyecto";
import { PipelineTarea } from "@/models/PipelineTarea";
import {
  PipelineDetailClient,
  type ProyectoDetalle,
  type TareaItem,
  type EmpleadoOption,
} from "./pipeline-detail-client";

export default async function PipelineDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("pipeline");
  await connectDB();

  const { id } = await params;
  const [proyecto, tareas, empleados] = await Promise.all([
    PipelineProyecto.findById(id).lean(),
    PipelineTarea.find({ proyectoId: id }).sort({ createdAt: -1 }).lean(),
    Employee.find({ active: true }).sort({ nombre: 1 }).lean(),
  ]);
  if (!proyecto) notFound();

  const detalle: ProyectoDetalle = {
    id: proyecto._id.toString(),
    nombre: proyecto.nombre,
    clienteNombre: proyecto.clienteNombre,
    color: proyecto.color,
    miembros: proyecto.miembros,
    fechaInicioISO: proyecto.fechaInicio?.toISOString().slice(0, 10),
    fechaFinISO: proyecto.fechaFin?.toISOString().slice(0, 10),
    prioridad: proyecto.prioridad,
    estado: proyecto.estado,
    notas: proyecto.notas,
  };

  const tareaItems: TareaItem[] = tareas.map((t) => ({
    id: t._id.toString(),
    titulo: t.titulo,
    descripcion: t.descripcion,
    responsable: t.responsable,
    prioridad: t.prioridad,
    estado: t.estado,
    vencimientoISO: t.vencimiento?.toISOString().slice(0, 10),
  }));

  const empleadoOptions: EmpleadoOption[] = empleados.map((e) => ({
    id: e._id.toString(),
    nombre: `${e.nombre} ${e.apellido}`.trim(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: detalle.color }} />
        <h1 className="text-2xl font-semibold">{detalle.nombre}</h1>
      </div>
      <PipelineDetailClient proyecto={detalle} tareas={tareaItems} empleados={empleadoOptions} />
    </div>
  );
}
