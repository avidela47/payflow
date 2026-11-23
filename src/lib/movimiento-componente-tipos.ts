// Ledger de movimientos de Componentes, portado de "Gestión de Luminarias"
// (ver planificacion/fusion-gestion-luminarias.md). El original tiene 4
// tipos pero el modal de registro manual solo ofrece 3 — "salida_produccion"
// queda reservado para cuando exista la lógica de "Fabricar" (todavía no
// construida, es un paso posterior dentro de la Fase 5). Mismo criterio que
// "numeroOrden" en MovimientoMaterial: se deja el lugar para lo que todavía
// no existe en vez de inventar algo a mitad de camino.
//
// "SALIDA_REPARACION" agregado el 2026-11-23 para el módulo Reparación
// (no existe en el original, ver models/Reparacion.ts): mismo criterio que
// SALIDA_PRODUCCION — reservado para la acción "ejecutar" de Reparación,
// no elegible a mano desde este formulario.
export const MOVIMIENTO_COMPONENTE_TIPOS = [
  "ENTRADA_COMPRA",
  "SALIDA_PRODUCCION",
  "SALIDA_REPARACION",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
] as const;
export type MovimientoComponenteTipo = (typeof MOVIMIENTO_COMPONENTE_TIPOS)[number];

// Los únicos 3 tipos que se pueden registrar a mano desde el formulario
// (igual que el original). SALIDA_PRODUCCION la va a generar en el futuro
// la lógica de Fabricar, no una persona desde este módulo.
export const MOVIMIENTO_COMPONENTE_TIPOS_MANUALES = [
  "ENTRADA_COMPRA",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
] as const;

const LABELS: Record<MovimientoComponenteTipo, string> = {
  ENTRADA_COMPRA: "Compra",
  SALIDA_PRODUCCION: "Producción",
  SALIDA_REPARACION: "Reparación",
  AJUSTE_ENTRADA: "Ajuste entrada",
  AJUSTE_SALIDA: "Ajuste salida",
};

export function movimientoComponenteTipoLabel(tipo: MovimientoComponenteTipo): string {
  return LABELS[tipo] ?? tipo;
}

export function movimientoComponenteTipoBadgeVariant(
  tipo: MovimientoComponenteTipo
): "success" | "destructive" | "primary" {
  if (tipo === "ENTRADA_COMPRA" || tipo === "AJUSTE_ENTRADA") return "success";
  if (tipo === "AJUSTE_SALIDA") return "destructive";
  return "primary";
}

export function esMovimientoDeEntrada(tipo: MovimientoComponenteTipo): boolean {
  return tipo === "ENTRADA_COMPRA" || tipo === "AJUSTE_ENTRADA";
}
