// Mismo criterio que material-unidades.ts/sensor-fuente-tipos.ts/luminaria-
// origen.ts: separado del modelo para que un componente "use client" lo
// importe sin arrastrar mongoose.
//
// Quinto módulo fusionado desde "Gestión de Luminarias" (Fase 5 — Producción,
// ver planificacion/fusion-gestion-luminarias.md). Lista propia (no se
// reusa MATERIAL_UNIDADES): Componentes son las piezas con las que se
// fabrican las Luminarias (tornillería, cables finos, resistencias, etc.),
// un dominio distinto al de Materiales de Obra — pero se mantiene fiel a
// las unidades del original (unidad, metro, metro lineal, kg, gramo,
// litro, ml, rollo, par, juego).
export const COMPONENTE_UNIDADES = [
  "UNIDAD",
  "METRO",
  "METRO_LINEAL",
  "KILOGRAMO",
  "GRAMO",
  "LITRO",
  "MILILITRO",
  "ROLLO",
  "PAR",
  "JUEGO",
] as const;
export type ComponenteUnidad = (typeof COMPONENTE_UNIDADES)[number];

const LABELS: Record<ComponenteUnidad, string> = {
  UNIDAD: "Unidad",
  METRO: "Metro",
  METRO_LINEAL: "Metro lineal",
  KILOGRAMO: "Kilogramo",
  GRAMO: "Gramo",
  LITRO: "Litro",
  MILILITRO: "Mililitro",
  ROLLO: "Rollo",
  PAR: "Par",
  JUEGO: "Juego",
};

export function componenteUnidadLabel(unidad: ComponenteUnidad): string {
  return LABELS[unidad] ?? unidad;
}