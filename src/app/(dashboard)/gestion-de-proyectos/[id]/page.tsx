import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Employee } from "@/models/Employee";
import { PipelineDetailClient } from "../../pipeline/[id]/pipeline-detail-client";
import type { EmpleadoOption } from "../../pipeline/pipeline-client";

export default async function GestionDeProyectosDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("gestion-de-proyectos");
  await connectDB();
  const { id } = await params;
  const empleadosDocs = await Employee.find({ active: true }).sort({ nombre: 1 }).lean();
  const empleados: EmpleadoOption[] = empleadosDocs.map((e) => ({
    id: e._id.toString(),
    nombre: e.nombre,
    apellido: e.apellido,
    dni: e.dni,
    nac: e.fechaNacimiento ? new Date(e.fechaNacimiento).toISOString().slice(0, 10) : undefined,
  }));
  return <PipelineDetailClient proyectoId={id} empleados={empleados} />;
}
