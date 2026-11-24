// Separado de los modelos para que un componente "use client" lo importe
// sin arrastrar mongoose (mismo criterio que reparacion-estados.ts/
// proyecto-estados.ts y el resto de los lib/*.ts de la fusión).
//
// Módulo nuevo pedido por Ariel el 2026-11-24: portar lo útil de
// "proyectos-itelsa" (repo avidela47/protectos-itelsa, Firebase/
// Firestore) a PayFlow como módulo "Proyectos" en el sidebar, justo
// después de Dashboard y Reportes. El original tenía 8 pestañas
// (Weeklys, Proyectos/pipeline, Arquitectura, Marketing, Gestión de
// Proyectos, Accesos, Generador de Cómputos, Cómputo Privado); acá se
// porta SOLO la pestaña "pipeline" (Proyecto + Tarea, Kanban de 3
// estados) — las demás no fueron pedidas, y Accesos ya existe en
// PayFlow como Vault.
//
// NOMBRES: PayFlow ya tiene un modelo "Proyecto" (proyecto de FÁBRICA,
// ver src/models/Proyecto.ts — se genera al ejecutar una Orden de
// Trabajo, lo usa el taller en /fabrica-proyectos). Es un concepto
// totalmente distinto al pipeline comercial que se porta acá. Para no
// repetir la confusión de nombres que ya señaló Ariel con "Herramientas"
// (sidebar vs. Componentes de fábrica), los modelos/ruta/moduleKey de
// este módulo se llaman "Pipeline*" / "/pipeline" — el ítem del sidebar
// sí dice "Proyectos" (lo que pidió Ariel), pero el código interno queda
// inconfundible con el Proyecto de fábrica.
export const PIPELINE_PROYECTO_ESTADOS = [
  "EN_CURSO",
  "VENDIDO",
  "PAUSADO",
  "FINALIZADO",
  "CANCELADO",
] as const;
export type PipelineProyectoEstado = (typeof PIPELINE_PROYECTO_ESTADOS)[number];

const PROYECTO_LABELS: Record<PipelineProyectoEstado, string> = {
  EN_CURSO: "En curso",
  VENDIDO: "Vendido",
  PAUSADO: "Pausado",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export function pipelineProyectoEstadoLabel(estado: PipelineProyectoEstado): string {
  return PROYECTO_LABELS[estado] ?? estado;
}

export function pipelineProyectoEstadoBadgeVariant(
  estado: PipelineProyectoEstado
): "success" | "warning" | "primary" | "destructive" | "default" {
  if (estado === "VENDIDO" || estado === "FINALIZADO") return "success";
  if (estado === "EN_CURSO") return "primary";
  if (estado === "PAUSADO") return "warning";
  if (estado === "CANCELADO") return "destructive";
  return "default";
}

// Tarea: calcado del Kanban de 3 columnas del original (Pendiente / En
// curso / Terminado). Sin drag-and-drop (PayFlow no usa esa interacción
// en ningún otro lado) — se mueve de columna con un botón, mismo
// criterio que el resto de los flujos de estado de la fusión (Tomar/
// Ejecutar en Reparación y OrdenTrabajo).
export const PIPELINE_TAREA_ESTADOS = ["PENDIENTE", "EN_CURSO", "TERMINADO"] as const;
export type PipelineTareaEstado = (typeof PIPELINE_TAREA_ESTADOS)[number];

const TAREA_LABELS: Record<PipelineTareaEstado, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  TERMINADO: "Terminado",
};

export function pipelineTareaEstadoLabel(estado: PipelineTareaEstado): string {
  return TAREA_LABELS[estado] ?? estado;
}

export const PIPELINE_PRIORIDADES = ["ALTA", "MEDIA", "BAJA"] as const;
export type PipelinePrioridad = (typeof PIPELINE_PRIORIDADES)[number];

const PRIORIDAD_LABELS: Record<PipelinePrioridad, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export function pipelinePrioridadLabel(prioridad: PipelinePrioridad): string {
  return PRIORIDAD_LABELS[prioridad] ?? prioridad;
}

export function pipelinePrioridadBadgeVariant(
  prioridad: PipelinePrioridad
): "destructive" | "warning" | "default" {
  if (prioridad === "ALTA") return "destructive";
  if (prioridad === "MEDIA") return "warning";
  return "default";
}
