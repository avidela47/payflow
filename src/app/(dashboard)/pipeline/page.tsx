import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { PipelineClient, type ClienteOption } from "./pipeline-client";

// Página servidor: solo gatea el acceso (requireModuleAccess) y trae el
// listado de Clientes REALES de PayFlow (Mongo) para el selector del
// formulario — pedido explícito de Ariel desde el arranque ("quiero que
// tome el cliente cargado en payflow"). Todo lo demás (proyectos, tareas)
// vive en Firestore y se lee client-side en tiempo real, por eso el resto
// de esta pantalla es un solo componente "use client" sin más fetch server.
export default async function PipelinePage() {
  await requireModuleAccess("pipeline");
  await connectDB();

  const clientesDocs = await Client.find({}).sort({ nombre: 1 }).lean();
  const clientes: ClienteOption[] = clientesDocs.map((c) => ({
    id: c._id.toString(),
    nombre: c.nombre,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline comercial y de gestión — misma base en vivo que proyectos-itelsa.itelsasas.com.
        </p>
      </div>
      <PipelineClient clientes={clientes} />
    </div>
  );
}
