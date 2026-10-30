import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Convierte lo que haya tipeado el usuario a número, sin importar si usó
// coma o punto como separador decimal (acá se usa coma, pero los inputs
// no deben depender de que el usuario lo escriba "bien"):
// - "607277,50" -> 607277.5
// - "607.277,50" (con separador de miles) -> 607277.5
// - "607277.50" -> 607277.5
export function parseAmount(raw: string): number {
  let s = raw.trim();
  if (!s) return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Formato con miles y decimales: "607.277,50" -> el punto es de
    // miles, la coma es el decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Solo coma: es el separador decimal.
    s = s.replace(",", ".");
  }
  // Si solo hay punto (o ningún separador), ya queda en formato válido.

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function formatPeriod(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatFullDate(date: Date): string {
  const text = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}