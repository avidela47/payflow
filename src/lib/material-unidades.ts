// Mismo criterio que sensor-fuente-tipos.ts/luminaria-origen.ts/herramienta-
// estados.ts: separado del modelo para que un componente "use client" lo
// importe sin arrastrar mongoose.
//
// Cuarto módulo fusionado desde "Gestión de Luminarias". En esa app
// "unidad" era texto libre (default "unidad"); acá se fija a una lista
// corta para que quede consistente en los selects — cubre lo habitual de
// materiales de obra (cable, caño, cemento, etc.).
export const MATERIAL_UNIDADES = [
  "UNIDAD",
  "METRO",
  "KILOGRAMO",
  "LITRO",
  "CAJA",
  "ROLLO",
  "BOLSA",
  "OTRO",
] as const;
export type MaterialUnidad = (typeof MATERIAL_UNIDADES)[number];

const LABELS: Record<MaterialUnidad, string> = {
  UNIDAD: "Unidad",
  METRO: "Metro",
  KILOGRAMO: "Kilogramo",
  LITRO: "Litro",
  CAJA: "Caja",
  ROLLO: "Rollo",
  BOLSA: "Bolsa",
  OTRO: "Otro",
};

export function materialUnidadLabel(unidad: MaterialUnidad): string {
  return LABELS[unidad] ?? unidad;
}