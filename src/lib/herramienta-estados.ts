// Mismo criterio que sensor-fuente-tipos.ts/luminaria-origen.ts: separado
// de src/models/Herramienta.ts para que un componente "use client" lo
// importe sin arrastrar mongoose.
//
// Tercer módulo fusionado desde "Gestión de Luminarias" (ver
// planificacion/fusion-gestion-luminarias.md). En esa app el estado se
// maneja a mano (sin automatismo de préstamo/devolución) — acá se respeta
// lo mismo: cantidadDisponible y estado se editan manualmente, no hay
// todavía un flujo de "retirar/devolver herramienta" (quedaría para una
// fase posterior si hace falta).
export const HERRAMIENTA_ESTADOS = ["DISPONIBLE", "EN_USO", "REPARACION", "BAJA"] as const;
export type HerramientaEstado = (typeof HERRAMIENTA_ESTADOS)[number];

const LABELS: Record<HerramientaEstado, string> = {
  DISPONIBLE: "Disponible",
  EN_USO: "En uso",
  REPARACION: "Reparación",
  BAJA: "Baja",
};

export function herramientaEstadoLabel(estado: HerramientaEstado): string {
  return LABELS[estado] ?? estado;
}

export function herramientaEstadoBadgeVariant(
  estado: HerramientaEstado
): "success" | "primary" | "warning" | "destructive" {
  if (estado === "DISPONIBLE") return "success";
  if (estado === "EN_USO") return "primary";
  if (estado === "REPARACION") return "warning";
  return "destructive";
}