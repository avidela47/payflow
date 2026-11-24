import { requireModuleAccess } from "@/lib/auth";
import { PipelineDetailClient } from "./pipeline-detail-client";

// Igual que /pipeline: la página servidor solo gatea el acceso. El proyecto
// y sus tareas se leen client-side desde Firestore en tiempo real (mismo
// motivo que la lista).
export default async function PipelineDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("pipeline");
  const { id } = await params;
  return <PipelineDetailClient proyectoId={id} />;
}
