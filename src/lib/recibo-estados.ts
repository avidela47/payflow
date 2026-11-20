// Separado de src/models/Recibo.ts para que un componente "use client" lo
// importe sin arrastrar mongoose (mismo criterio que el resto de los
// lib/*.ts de la fusión con Gestión de Luminarias).
//
// El original llama "Cancelado" al estado de saldo cero (saldo_usd <= 0),
// lo cual no es "cancelado" en el sentido de anulado — es simplemente
// pagado del todo. Se renombra a PAGADO para no confundirlo con una
// anulación administrativa (que este módulo no tiene: no hay "anular
// recibo" ni en el original ni acá, solo borrar).
export const RECIBO_ESTADOS = ["PENDIENTE", "PARCIAL", "PAGADO"] as const;
export type ReciboEstado = (typeof RECIBO_ESTADOS)[number];

const LABELS: Record<ReciboEstado, string> = {
  PENDIENTE: "Pendiente de pago",
  PARCIAL: "Pago parcial",
  PAGADO: "Pagado",
};

export function reciboEstadoLabel(estado: ReciboEstado): string {
  return LABELS[estado] ?? estado;
}

export function reciboEstadoBadgeVariant(
  estado: ReciboEstado
): "default" | "warning" | "primary" | "success" {
  if (estado === "PENDIENTE") return "warning";
  if (estado === "PARCIAL") return "primary";
  if (estado === "PAGADO") return "success";
  return "default";
}

export const FORMAS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

const FORMA_PAGO_LABELS: Record<FormaPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  DEPOSITO: "Depósito",
};

export function formaPagoLabel(forma: FormaPago): string {
  return FORMA_PAGO_LABELS[forma] ?? forma;
}