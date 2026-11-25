import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { PipelineClient, type ClienteOption } from "../pipeline/pipeline-client";

export default async function GestionDeProyectosPage() {
  await requireModuleAccess("gestion-de-proyectos");
  await connectDB();
  const clientesDocs = await Client.find({}).sort({ nombre: 1 }).lean();
  const clientes: ClienteOption[] = clientesDocs.map((c) => ({ id: c._id.toString(), nombre: c.nombre }));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Gestión de Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          Seguimiento de obra — misma base en vivo que proyectos-itelsa.itelsasas.com.
        </p>
      </div>
      <PipelineClient clientes={clientes} section="gestion" />
    </div>
  );
}
