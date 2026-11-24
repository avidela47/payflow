import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { Employee } from "@/models/Employee";
import { PipelineProyecto } from "@/models/PipelineProyecto";
import { PipelineClient, type ProyectoItem, type ClienteOption, type EmpleadoOption } from "./pipeline-client";

export default async function PipelinePage() {
  await requireModuleAccess("pipeline");
  await connectDB();

  const [proyectos, clientes, empleados] = await Promise.all([
    PipelineProyecto.find({}).sort({ createdAt: -1 }).lean(),
    Client.find({}).sort({ nombre: 1 }).lean(),
    Employee.find({ active: true }).sort({ nombre: 1 }).lean(),
  ]);

  const items: ProyectoItem[] = proyectos.map((p) => ({
    id: p._id.toString(),
    nombre: p.nombre,
    clienteId: p.clienteId?.toString(),
    clienteNombre: p.clienteNombre,
    color: p.color,
    miembros: p.miembros,
    fechaInicioISO: p.fechaInicio?.toISOString().slice(0, 10),
    fechaFinISO: p.fechaFin?.toISOString().slice(0, 10),
    prioridad: p.prioridad,
    estado: p.estado,
  }));

  const clienteOptions: ClienteOption[] = clientes.map((c) => ({
    id: c._id.toString(),
    nombre: c.nombre,
  }));

  const empleadoOptions: EmpleadoOption[] = empleados.map((e) => ({
    id: e._id.toString(),
    nombre: `${e.nombre} ${e.apellido}`.trim(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline comercial y de gestión — portado de proyectos-itelsa. Cada proyecto tiene su
          propio Kanban de tareas.
        </p>
      </div>
      <PipelineClient items={items} clientes={clienteOptions} empleados={empleadoOptions} />
    </div>
  );
}
