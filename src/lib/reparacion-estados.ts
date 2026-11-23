// Separado de src/models/Reparacion.ts para que un componente "use
// client" lo importe sin arrastrar mongoose (mismo criterio que
// orden-trabajo-estados.ts y el resto de los lib/*.ts de la fusión con
// Gestión de Luminarias).
//
// Reparación no existe en el original — es un módulo nuevo pedido por
// Ariel el 2026-11-23 ("funciona como OT"), sin página de referencia que
// mirrorear. Por eso el enum es más simple que el de OrdenTrabajo: no hay
// un estado intermedio "EN_FABRICA" porque Reparación no genera ningún
// Proyecto de fábrica — el consumo de Componentes se elige a mano al
// ejecutar, caso por caso (confirmado por Ariel: no es por Receta), y la
// luminaria en sí es del cliente, nunca toca el stock de Luminaria.
export const REPARACION_ESTADOS = ["PENDIENTE", "EN_PROCESO"] as const;
export type ReparacionEstado = (typeof REPARACION_ESTADOS)[number];

const LABELS: Record<ReparacionEstado, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
};

export function reparacionEstadoLabel(estado: ReparacionEstado): string {
  return LABELS[estado] ?? estado;
}

export function reparacionEstadoBadgeVariant(estado: ReparacionEstado): "success" | "primary" {
  return estado === "EN_PROCESO" ? "success" : "primary";
}
