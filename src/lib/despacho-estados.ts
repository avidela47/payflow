// Separado de src/models/Despacho.ts para que un componente "use client"
// lo importe sin arrastrar mongoose (mismo criterio que el resto de los
// lib/*.ts de la fusión con Gestión de Luminarias).
export const DESPACHO_ESTADOS = ["PENDIENTE", "DESPACHADO", "ANULADO"] as const;
export type DespachoEstado = (typeof DESPACHO_ESTADOS)[number];

const LABELS: Record<DespachoEstado, string> = {
  PENDIENTE: "Pendiente",
  DESPACHADO: "Despachado",
  ANULADO: "Anulado",
};

export function despachoEstadoLabel(estado: DespachoEstado): string {
  return LABELS[estado] ?? estado;
}

export function despachoEstadoBadgeVariant(
  estado: DespachoEstado
): "default" | "success" | "destructive" {
  if (estado === "DESPACHADO") return "success";
  if (estado === "ANULADO") return "destructive";
  return "default";
}