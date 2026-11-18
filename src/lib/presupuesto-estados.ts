// Separado de src/models/Presupuesto.ts para que un componente "use
// client" lo importe sin arrastrar mongoose (mismo criterio que el resto
// de los lib/*.ts de la fusión con Gestión de Luminarias).
export const PRESUPUESTO_ESTADOS = ["BORRADOR", "ENVIADO", "APROBADO", "RECHAZADO"] as const;
export type PresupuestoEstado = (typeof PRESUPUESTO_ESTADOS)[number];

const LABELS: Record<PresupuestoEstado, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export function presupuestoEstadoLabel(estado: PresupuestoEstado): string {
  return LABELS[estado] ?? estado;
}

export function presupuestoEstadoBadgeVariant(
  estado: PresupuestoEstado
): "default" | "primary" | "success" | "destructive" {
  if (estado === "ENVIADO") return "primary";
  if (estado === "APROBADO") return "success";
  if (estado === "RECHAZADO") return "destructive";
  return "default";
}