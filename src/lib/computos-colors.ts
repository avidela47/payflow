// Paleta de colores para los marcadores del plano — calcada de CG_COLORS en
// el original (/tmp/protectos-itelsa/index.html, línea ~2380). Un color por
// posición de ítem en la lista (se repite cada 16 si hay más luminarias que
// colores), igual en la pantalla y en el PDF.
export const MARCADOR_COLORS = [
  "#E53935",
  "#1E88E5",
  "#43A047",
  "#FB8C00",
  "#8E24AA",
  "#00ACC1",
  "#F4511E",
  "#3949AB",
  "#7CB342",
  "#D81B60",
  "#6D4C41",
  "#546E7A",
  "#FDD835",
  "#00897B",
  "#5E35B1",
  "#C0CA33",
];

export function colorDeItem(idx: number): string {
  return MARCADOR_COLORS[idx % MARCADOR_COLORS.length];
}

export function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.substr(1, 2), 16), parseInt(hex.substr(3, 2), 16), parseInt(hex.substr(5, 2), 16)];
}
