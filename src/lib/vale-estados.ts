// Separado de src/models/Vale.ts para que un componente "use client" lo
// importe sin arrastrar mongoose (mismo criterio que el resto de los
// lib/*.ts de la fusión con Gestión de Luminarias).
//
// Estados calcados del original (abierto/devolucion_parcial/cerrado), en
// mayúsculas por consistencia con el resto de la fusión. Se recalculan
// solos a partir de los ítems, nunca se eligen a mano.
export const VALE_ESTADOS = ["ABIERTO", "DEVOLUCION_PARCIAL", "CERRADO"] as const;
export type ValeEstado = (typeof VALE_ESTADOS)[number];

const ESTADO_LABELS: Record<ValeEstado, string> = {
  ABIERTO: "Abierto",
  DEVOLUCION_PARCIAL: "Devolución parcial",
  CERRADO: "Cerrado",
};

export function valeEstadoLabel(estado: ValeEstado): string {
  return ESTADO_LABELS[estado] ?? estado;
}

export function valeEstadoBadgeVariant(
  estado: ValeEstado
): "warning" | "primary" | "success" {
  if (estado === "CERRADO") return "success";
  if (estado === "DEVOLUCION_PARCIAL") return "primary";
  return "warning";
}

// "tipo" de cada ítem es solo informativo (a qué catálogo pertenecía lo
// prestado) — no es una referencia real, ver nota en models/Vale.ts.
export const VALE_ITEM_TIPOS = ["STOCK", "HERRAMIENTA", "OTRO"] as const;
export type ValeItemTipo = (typeof VALE_ITEM_TIPOS)[number];

const TIPO_LABELS: Record<ValeItemTipo, string> = {
  STOCK: "Stock",
  HERRAMIENTA: "Herramienta",
  OTRO: "Otro",
};

export function valeItemTipoLabel(tipo: ValeItemTipo): string {
  return TIPO_LABELS[tipo] ?? tipo;
}
