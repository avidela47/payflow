// Separado de src/models/OrdenTrabajo.ts para que un componente "use
// client" lo importe sin arrastrar mongoose (mismo criterio que el resto
// de los lib/*.ts de la fusión con Gestión de Luminarias). El original
// tiene además 'Completada'/'Cancelada' en el enum pero ningún código los
// asigna nunca — no se replican, ver nota en models/OrdenTrabajo.ts.
export const ORDEN_TRABAJO_ESTADOS = ["PENDIENTE", "EN_FABRICA", "EN_PROCESO"] as const;
export type OrdenTrabajoEstado = (typeof ORDEN_TRABAJO_ESTADOS)[number];

const LABELS: Record<OrdenTrabajoEstado, string> = {
  PENDIENTE: "Pendiente",
  EN_FABRICA: "En fábrica",
  EN_PROCESO: "En proceso",
};

export function ordenTrabajoEstadoLabel(estado: OrdenTrabajoEstado): string {
  return LABELS[estado] ?? estado;
}

export function ordenTrabajoEstadoBadgeVariant(
  estado: OrdenTrabajoEstado
): "success" | "warning" | "primary" {
  if (estado === "EN_PROCESO") return "success";
  if (estado === "EN_FABRICA") return "warning";
  return "primary";
}
