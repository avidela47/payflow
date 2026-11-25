import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { PipelineClient, type ClienteOption } from "../pipeline/pipeline-client";

// Arquitectura — misma pantalla y el mismo motor que Proyectos
// (pipeline-client.tsx), reutilizado parametrizado por `section`: en
// Firestore ambas viven en la colección "projects" compartida con
// proyectos-itelsa.itelsasas.com, discriminadas por section ("pipeline" vs.
// "proyectos" — este último es el valor interno histórico de Arquitectura,
// se mantiene por compatibilidad con datos ya guardados en esa base real).
// Mismo criterio que "../pipeline/quien-sos" ya se importaba cruzado desde
// /computos: reutilizar en vez de duplicar.
export default async function ArquitecturaPage() {
  await requireModuleAccess("arquitectura");
  await connectDB();

  const clientesDocs = await Client.find({}).sort({ nombre: 1 }).lean();
  const clientes: ClienteOption[] = clientesDocs.map((c) => ({
    id: c._id.toString(),
    nombre: c.nombre,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Arquitectura</h1>
        <p className="text-sm text-muted-foreground">
          Seguimiento de obra — misma base en vivo que proyectos-itelsa.itelsasas.com.
        </p>
      </div>
      <PipelineClient clientes={clientes} section="proyectos" />
    </div>
  );
}
