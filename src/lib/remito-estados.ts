// Separado de src/models/Remito.ts para que un componente "use client"
// lo importe sin arrastrar mongoose (mismo criterio que el resto de los
// lib/*.ts de la fusión con Gestión de Luminarias).
export const REMITO_ESTADOS = ["BORRADOR", "EMITIDO", "ENTREGADO", "CANCELADO"] as const;
export type RemitoEstado = (typeof REMITO_ESTADOS)[number];

const LABELS: Record<RemitoEstado, string> = {
  BORRADOR: "Borrador",
  EMITIDO: "Emitido",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export function remitoEstadoLabel(estado: RemitoEstado): string {
  return LABELS[estado] ?? estado;
}

export function remitoEstadoBadgeVariant(
  estado: RemitoEstado
): "default" | "primary" | "success" | "destructive" {
  if (estado === "EMITIDO") return "primary";
  if (estado === "ENTREGADO") return "success";
  if (estado === "CANCELADO") return "destructive";
  return "default";
}