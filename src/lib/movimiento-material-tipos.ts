// Separado de src/models/MovimientoMaterial.ts para que un componente
// "use client" lo importe sin arrastrar mongoose (mismo criterio que el
// resto de los lib/*.ts de la fusión con Gestión de Luminarias).
export const MOVIMIENTO_MATERIAL_TIPOS = ["ENTRADA", "SALIDA", "DEVOLUCION"] as const;
export type MovimientoMaterialTipo = (typeof MOVIMIENTO_MATERIAL_TIPOS)[number];

const LABELS: Record<MovimientoMaterialTipo, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  DEVOLUCION: "Devolución",
};

export function movimientoMaterialTipoLabel(tipo: MovimientoMaterialTipo): string {
  return LABELS[tipo] ?? tipo;
}

export function movimientoMaterialTipoBadgeVariant(
  tipo: MovimientoMaterialTipo
): "success" | "destructive" | "primary" {
  if (tipo === "ENTRADA") return "success";
  if (tipo === "SALIDA") return "destructive";
  return "primary";
}