// Mismo criterio que sensor-fuente-tipos.ts/ganancias-conditions.ts: separado
// de src/models/Luminaria.ts para que un componente "use client" lo importe
// sin arrastrar mongoose.
//
// En Luminarias (la app fusionada acá) esto eran DOS colecciones distintas
// (ProductoTerminado = fabricadas, con stock automático vía Fabricar/BOM;
// LuminariaComercial = importadas de China o depósito nacional, con stock
// manual). En PayFlow se unifican en un solo modelo Luminaria con un campo
// "origen" — más simple que mantener dos colecciones y unirlas en la UI
// como hacía la app original.
export const LUMINARIA_ORIGENES = ["FABRICADA", "IMPORTADA", "NACIONAL"] as const;
export type LuminariaOrigen = (typeof LUMINARIA_ORIGENES)[number];

const LABELS: Record<LuminariaOrigen, string> = {
  FABRICADA: "Fabricada",
  IMPORTADA: "Importada",
  NACIONAL: "Depósito nacional",
};

export function luminariaOrigenLabel(origen: LuminariaOrigen): string {
  return LABELS[origen] ?? origen;
}

export function luminariaOrigenBadgeVariant(
  origen: LuminariaOrigen
): "default" | "success" | "primary" {
  if (origen === "FABRICADA") return "success";
  if (origen === "IMPORTADA") return "primary";
  return "default";
}