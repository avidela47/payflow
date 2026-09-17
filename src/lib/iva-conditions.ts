// Igual criterio que note-colors.ts: separado de src/models/Client.ts (que
// importa mongoose) para que un componente "use client" pueda importar
// esta lista sin arrastrar mongoose entero al bundle del browser.
export const IVA_CONDITIONS = [
  "Responsable Inscripto",
  "Monotributo",
  "Exento",
  "Consumidor Final",
  "No Responsable",
] as const;

export type IvaCondition = (typeof IVA_CONDITIONS)[number];