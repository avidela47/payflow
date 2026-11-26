// Cálculo de IVA al 21% compartido entre Viajes (viaticos-client.tsx) y el
// Simulador de viajes (simulador-viajes.tsx) — 2026-11-26, pedido de
// Ariel: en todos los campos de monto de ambos modales, al cargar el
// neto se autocompleta el IVA al 21%, pero el campo sigue siendo
// editable a mano por si el valor real difiere.
export const IVA_RATE = 0.21;

export function calcIva21(neto: number): number {
  return Math.round((neto || 0) * IVA_RATE * 100) / 100;
}

// Decide el IVA a dejar en una fila después de cambiar su neto: si el IVA
// actual coincide con el 21% calculado sobre el neto ANTERIOR (o está
// vacío/0, caso típico de una fila nueva), se lo considera "automático"
// y se recalcula con el neto nuevo. Si el usuario ya lo pisó a mano con
// un valor distinto, se respeta tal cual — así el campo queda editable
// sin perder lo que haya tipeado.
export function nextIva(prevNeto: number, prevIva: number | undefined, newNeto: number): number {
  const expectedOld = calcIva21(prevNeto);
  const wasAuto = !prevIva || Math.abs(prevIva - expectedOld) < 0.01;
  return wasAuto ? calcIva21(newNeto) : prevIva;
}
