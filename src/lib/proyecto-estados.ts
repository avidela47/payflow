// Separado de src/models/Proyecto.ts para que un componente "use client"
// lo importe sin arrastrar mongoose (mismo criterio que el resto de los
// lib/*.ts de la fusión con Gestión de Luminarias).
export const PROYECTO_PRIORIDADES = ["NORMAL", "URGENTE"] as const;
export type ProyectoPrioridad = (typeof PROYECTO_PRIORIDADES)[number];

export const PROYECTO_ESTADOS = ["NUEVO", "PREPARACION", "FABRICACION", "LISTO"] as const;
export type ProyectoEstado = (typeof PROYECTO_ESTADOS)[number];

const LABELS: Record<ProyectoEstado, string> = {
  NUEVO: "Nuevo",
  PREPARACION: "Preparación",
  FABRICACION: "Fabricación",
  LISTO: "Listo",
};

export function proyectoEstadoLabel(estado: ProyectoEstado): string {
  return LABELS[estado] ?? estado;
}

export function proyectoEstadoBadgeVariant(
  estado: ProyectoEstado
): "success" | "warning" | "primary" | "destructive" {
  if (estado === "LISTO") return "success";
  if (estado === "NUEVO") return "warning";
  return "primary";
}
