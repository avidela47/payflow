// Logo real de ITELSA (el mismo <img alt="ITELSA"> embebido en
// /tmp/protectos-itelsa/index.html) — se usa para el encabezado del PDF de
// cierre de cómputos (cgPdf del original), igual que el original lo toma
// del DOM. Se incrusta como constante en vez de un archivo en /public para
// no depender de un fetch extra al generar el PDF.
export const ITELSA_LOGO_DATA_URL =
  "' + data + '";
