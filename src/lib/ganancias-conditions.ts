// Igual criterio que iva-conditions.ts: separado de src/models/Provider.ts
// (que importa mongoose) para que un componente "use client" pueda
// importar esta lista sin arrastrar mongoose entero al bundle del browser.
//
// Condición del proveedor frente a Ganancias — NO es lo mismo que la
// condición de IVA (condicionIva). Define qué alícuota de retención le
// corresponde en el módulo Pagos (ver RetentionRegime): un inscripto tiene
// un mínimo no sujeto a retención y una alícuota más baja; a un no
// inscripto se le retiene sobre el total, sin mínimo.
export const GANANCIAS_CONDITIONS = ["INSCRIPTO", "NO_INSCRIPTO"] as const;
export type GananciasCondition = (typeof GANANCIAS_CONDITIONS)[number];

export function gananciasConditionLabel(cond: GananciasCondition) {
  return cond === "INSCRIPTO" ? "Inscripto" : "No inscripto";
}