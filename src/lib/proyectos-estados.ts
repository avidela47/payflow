// Enums y helpers de la pestaña "Proyectos" (Firestore) — mismo patrón que el
// resto de PayFlow (lib file como fuente de verdad, ver pipeline-estados.ts del
// módulo anterior, borrado, y reparacion-estados.ts).
// Badge no exporta un tipo de variant propio — se calca la unión real de
// variantes definidas en components/ui/badge.tsx.
type BadgeVariant = "default" | "success" | "warning" | "destructive" | "primary";

export const PROYECTO_ESTADOS = ["activo", "vendido", "finalizado"] as const;
export type ProyectoEstado = (typeof PROYECTO_ESTADOS)[number];

export const PROYECTO_PRIORIDADES = ["alta", "media", "baja"] as const;
export type ProyectoPrioridad = (typeof PROYECTO_PRIORIDADES)[number];

export const TAREA_ESTADOS = ["pendiente", "en-curso", "terminado"] as const;
export type TareaEstado = (typeof TAREA_ESTADOS)[number];

// `arquitectura` cambia el label de "finalizado" a "Terminado" — mismo
// texto que usa el original para esa sección (Arquitectura no vende nada,
// "Finalizado" no es el término correcto ahí). Arquitectura tampoco usa el
// estado "vendido" (se oculta esa opción en la UI), pero el tipo sigue
// siendo el mismo enum — no hace falta una unión aparte.
export function proyectoEstadoLabel(estado: ProyectoEstado, arquitectura = false): string {
  switch (estado) {
    case "activo":
      return "Activo";
    case "vendido":
      return "Vendido";
    case "finalizado":
      return arquitectura ? "Terminado" : "Finalizado";
  }
}

export function proyectoEstadoBadgeVariant(estado: ProyectoEstado): BadgeVariant {
  switch (estado) {
    case "activo":
      return "primary";
    case "vendido":
      return "success";
    case "finalizado":
      return "default";
  }
}

export function prioridadLabel(p: ProyectoPrioridad): string {
  switch (p) {
    case "alta":
      return "Alta";
    case "media":
      return "Media";
    case "baja":
      return "Baja";
  }
}

export function prioridadBadgeVariant(p: ProyectoPrioridad): BadgeVariant {
  switch (p) {
    case "alta":
      return "destructive";
    case "media":
      return "warning";
    case "baja":
      return "default";
  }
}

export function tareaEstadoLabel(estado: TareaEstado): string {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "en-curso":
      return "En curso";
    case "terminado":
      return "Terminado";
  }
}
