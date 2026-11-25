// "Necesario del proyecto" — checklist de qué insumos hacen falta para esta
// venta/obra. Port literal del array NECESARIOS en
// /tmp/protectos-itelsa/index.html (líneas 927-932). Cada ítem es
// "necesario" por default (true) salvo que se haya destildado explícitamente
// — mismo criterio que el original (`necesario[item.id] !== false`).
export const NECESARIOS = [
  { id: "n_dialux", label: "DIALux" },
  { id: "n_luminarias", label: "Recuento de luminarias" },
  { id: "n_pdf", label: "PDF presentación" },
  { id: "n_video", label: "Video presentación" },
] as const;
