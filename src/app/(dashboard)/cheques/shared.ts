// Compartido entre las 3 páginas de Cheques (landing de tipo, landing de
// vista, y la lista final) — evita repetir el mapeo slug-de-URL ↔
// tipo/estado de Mongo en cada archivo.
import type { CheckType, CheckDirection, CheckStatus } from "@/models/Check";

export const TIPO_SLUGS = ["fisicos", "electronicos"] as const;
export type TipoSlug = (typeof TIPO_SLUGS)[number];

export const VISTA_SLUGS = ["recibidos", "emitidos", "endosados"] as const;
export type VistaSlug = (typeof VISTA_SLUGS)[number];

export const TIPO_TO_TYPE: Record<TipoSlug, CheckType> = {
  fisicos: "FISICO",
  electronicos: "ELECTRONICO",
};

export const TIPO_LABELS: Record<TipoSlug, string> = {
  fisicos: "Físicos",
  electronicos: "Electrónicos (e-cheq)",
};

export const VISTA_LABELS: Record<VistaSlug, string> = {
  recibidos: "Recibidos",
  emitidos: "Emitidos",
  endosados: "Endosados",
};

export const VISTA_TO_DIRECTION: Record<VistaSlug, CheckDirection> = {
  recibidos: "RECIBIDO",
  emitidos: "EMITIDO",
  endosados: "RECIBIDO",
};

export function isTipoSlug(value: string): value is TipoSlug {
  return (TIPO_SLUGS as readonly string[]).includes(value);
}

export function isVistaSlug(value: string): value is VistaSlug {
  return (VISTA_SLUGS as readonly string[]).includes(value);
}

// "Endosados" es un caso particular: mismo `direction` que Recibidos
// (RECIBIDO — solo se endosa un cheque que se recibió), pero filtrado
// además por estado = ENDOSADO. "Recibidos" excluye esos para no
// duplicarlos en las dos vistas.
export function checkFilterFor(tipo: TipoSlug, vista: VistaSlug) {
  const type = TIPO_TO_TYPE[tipo];
  const direction = VISTA_TO_DIRECTION[vista];

  if (vista === "endosados") {
    return { type, direction, status: "ENDOSADO" as CheckStatus };
  }
  if (vista === "recibidos") {
    return { type, direction, status: { $ne: "ENDOSADO" as CheckStatus } };
  }
  return { type, direction };
}