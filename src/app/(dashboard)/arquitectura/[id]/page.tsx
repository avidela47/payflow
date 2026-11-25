import { requireModuleAccess } from "@/lib/auth";
import { PipelineDetailClient } from "../../pipeline/[id]/pipeline-detail-client";

// Detalle de un proyecto de Arquitectura — mismo componente que el detalle
// de Proyectos (pipeline-detail-client.tsx), que ya decide qué mostrar
// leyendo `proyecto.section` del propio documento (no hace falta pasarle la
// sección por props: el doc la trae).
export default async function ArquitecturaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("arquitectura");
  const { id } = await params;
  return <PipelineDetailClient proyectoId={id} />;
}
