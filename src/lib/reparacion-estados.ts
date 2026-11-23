// Separado de src/models/Reparacion.ts para que un componente "use
// client" lo importe sin arrastrar mongoose (mismo criterio que
// orden-trabajo-estados.ts/proyecto-estados.ts y el resto de los
// lib/*.ts de la fusión con Gestión de Luminarias).
//
// Reparación no existe en el original — es un módulo nuevo pedido por
// Ariel el 2026-11-23 ("funciona como OT"), sin página de referencia que
// mirrorear. Ampliado el mismo día a pedido de Ariel: quería que el
// taller viera la reparación pendiente en la pantalla kiosco
// (/fabrica-proyectos) con la misma alerta que un Proyecto de fábrica
// nuevo, y que quedara registrado el proceso — quién la toma y quién la
// repara — igual que Proyecto (Tomar → trabajar → Listo). Por eso el
// enum pasó de 2 a 3 estados, calcado de PROYECTO_ESTADOS en vez de
// ORDEN_TRABAJO_ESTADOS:
// - PENDIENTE: recién creada, nadie la tomó todavía (dispara la alerta
//   en el kiosco, como "NUEVO" en Proyecto).
// - EN_PROCESO: un operario la tomó (tomadoPor) y está trabajando.
// - LISTA: terminada — ahí es cuando se descuentan a mano los
//   Componentes usados (ver actions.ts, ejecutarReparacion) y queda
//   ejecutada=true. No hay un estado intermedio tipo "FABRICACION" de
//   Proyecto porque una Reparación no tiene ítems parciales — es un
//   todo-o-nada por reparación.
export const REPARACION_ESTADOS = ["PENDIENTE", "EN_PROCESO", "LISTA"] as const;
export type ReparacionEstado = (typeof REPARACION_ESTADOS)[number];

const LABELS: Record<ReparacionEstado, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  LISTA: "Lista",
};

export function reparacionEstadoLabel(estado: ReparacionEstado): string {
  return LABELS[estado] ?? estado;
}

export function reparacionEstadoBadgeVariant(
  estado: ReparacionEstado
): "success" | "warning" | "primary" {
  if (estado === "LISTA") return "success";
  if (estado === "EN_PROCESO") return "primary";
  return "warning";
}
