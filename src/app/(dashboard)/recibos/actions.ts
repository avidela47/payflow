"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Recibo } from "@/models/Recibo";
import { FORMAS_PAGO } from "@/lib/recibo-estados";

function generarNumero(): Promise<string> {
  return Recibo.findOne()
    .sort({ createdAt: -1 })
    .then((ultimo) => {
      const anio = new Date().getFullYear();
      if (!ultimo?.numero) return `REC-${anio}-0001`;
      const partes = ultimo.numero.split("-");
      const num = parseInt(partes[2] || "0", 10) + 1;
      return `REC-${anio}-${String(num).padStart(4, "0")}`;
    });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const lineaSchema = z.object({
  descripcion: z.string().min(1, "Falta la descripción de un ítem del detalle."),
  montoUsd: z.coerce.number().positive("El monto de cada línea debe ser mayor a 0."),
});

const reciboSchema = z.object({
  fecha: z.coerce.date(),
  clientId: z.string().optional(),
  razonSocial: z.string().min(1, "Falta el cliente."),
  presupuestoId: z.string().optional(),
  numeroPresupuesto: z.string().optional(),
  numeroOrden: z.string().optional(),
  concepto: z.string().min(1, "Falta el concepto."),
  notas: z.string().optional(),
  lineas: z.array(lineaSchema).min(1, "Agregá al menos una línea de detalle."),
});

function parseLineasJson(formData: FormData): unknown {
  try {
    return JSON.parse((formData.get("lineasJson") as string) || "[]");
  } catch {
    return [];
  }
}

function parseReciboForm(formData: FormData) {
  return reciboSchema.safeParse({
    fecha: formData.get("fecha") || new Date(),
    clientId: formData.get("clientId") || undefined,
    razonSocial: formData.get("razonSocial"),
    presupuestoId: formData.get("presupuestoId") || undefined,
    numeroPresupuesto: formData.get("numeroPresupuesto") || undefined,
    numeroOrden: formData.get("numeroOrden") || undefined,
    concepto: formData.get("concepto"),
    notas: formData.get("notas") || undefined,
    lineas: parseLineasJson(formData),
  });
}

// Crear un recibo no mueve stock ni afecta nada más — es solo el
// documento de cobro. El total U$S siempre se recalcula server-side a
// partir de las líneas de detalle (nunca se confía en lo que manda el
// cliente), igual criterio que Presupuestos.
export async function createRecibo(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseReciboForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const numero = await generarNumero();
    const totalUsd = round2(parsed.data.lineas.reduce((acc, l) => acc + l.montoUsd, 0));
    await Recibo.create({
      ...parsed.data,
      numero,
      totalUsd,
      totalPagadoUsd: 0,
      saldoUsd: totalUsd,
      estado: "PENDIENTE",
    });
  } catch (err) {
    console.error("createRecibo error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/recibos");
  return { ok: true };
}

const pagoSchema = z.object({
  montoUsd: z.coerce.number().positive("El monto debe ser mayor a 0."),
  tipoCambio: z.coerce.number().positive("El tipo de cambio es obligatorio."),
  formaPago: z.enum(FORMAS_PAGO),
  notas: z.string().optional(),
});

// Registra un pago parcial (o el que cierra el saldo). Todo o nada, igual
// que el original: si el monto supera el saldo pendiente no se registra
// nada — no recorta el monto ni genera un pago "de más". El tipo de
// cambio es el de ESE pago, no uno global del recibo (cada cobro puede
// hacerse con un dólar distinto).
export async function registrarPago(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = pagoSchema.safeParse({
    montoUsd: formData.get("montoUsd"),
    tipoCambio: formData.get("tipoCambio"),
    formaPago: formData.get("formaPago"),
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const recibo = await Recibo.findById(id);
    if (!recibo) {
      return { ok: false, error: "El recibo ya no existe." };
    }
    if (recibo.estado === "PAGADO") {
      return { ok: false, error: "El recibo ya está pagado." };
    }
    if (parsed.data.montoUsd > recibo.saldoUsd) {
      return {
        ok: false,
        error: `El monto supera el saldo pendiente de U$S ${recibo.saldoUsd.toFixed(2)}.`,
      };
    }

    const montoPesos = round2(parsed.data.montoUsd * parsed.data.tipoCambio);
    const totalPagadoUsd = round2(recibo.totalPagadoUsd + parsed.data.montoUsd);
    const saldoUsd = round2(recibo.totalUsd - totalPagadoUsd);
    const estado = saldoUsd <= 0 ? "PAGADO" : "PARCIAL";

    await Recibo.findByIdAndUpdate(id, {
      $push: {
        pagos: {
          fecha: new Date(),
          montoUsd: parsed.data.montoUsd,
          tipoCambio: parsed.data.tipoCambio,
          montoPesos,
          formaPago: parsed.data.formaPago,
          notas: parsed.data.notas ?? "",
        },
      },
      $set: { totalPagadoUsd, saldoUsd, estado },
    });
  } catch (err) {
    console.error("registrarPago error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo registrar el pago: ${message}` };
  }

  revalidatePath("/recibos");
  return { ok: true };
}

const editarSchema = z.object({
  concepto: z.string().min(1, "Falta el concepto."),
  notas: z.string().optional(),
  lineas: z.array(lineaSchema).min(1, "Agregá al menos una línea de detalle."),
});

// Editar: solo concepto/detalle/observaciones, igual que el modal del
// original (no se puede cambiar cliente ni presupuesto después de creado).
//
// Agregado respecto del original: el original dejaba poner un total menor
// a lo ya cobrado (quedaba un saldo_usd negativo sin avisar, y el estado
// no se recalculaba — un recibo con saldo 0 podía seguir diciendo "Pago
// parcial"). Acá se bloquea si el nuevo total queda por debajo de lo ya
// pagado, y el estado se recalcula con la misma fórmula que un pago.
export async function updateRecibo(id: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = editarSchema.safeParse({
    concepto: formData.get("concepto"),
    notas: formData.get("notas") || undefined,
    lineas: parseLineasJson(formData),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const recibo = await Recibo.findById(id);
    if (!recibo) {
      return { ok: false, error: "El recibo ya no existe." };
    }

    const totalUsd = round2(parsed.data.lineas.reduce((acc, l) => acc + l.montoUsd, 0));
    if (totalUsd < recibo.totalPagadoUsd) {
      return {
        ok: false,
        error: `El nuevo total (U$S ${totalUsd.toFixed(2)}) es menor a lo ya cobrado (U$S ${recibo.totalPagadoUsd.toFixed(2)}).`,
      };
    }

    const saldoUsd = round2(totalUsd - recibo.totalPagadoUsd);
    const estado = saldoUsd <= 0 ? "PAGADO" : recibo.totalPagadoUsd > 0 ? "PARCIAL" : "PENDIENTE";

    await Recibo.findByIdAndUpdate(id, {
      $set: {
        concepto: parsed.data.concepto,
        lineas: parsed.data.lineas,
        notas: parsed.data.notas ?? "",
        totalUsd,
        saldoUsd,
        estado,
      },
    });
  } catch (err) {
    console.error("updateRecibo error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo editar: ${message}` };
  }

  revalidatePath("/recibos");
  return { ok: true };
}

// Borrar: bloqueado si ya tiene pagos registrados (decisión de Ariel,
// 2026-11-20: "que quede el historial") — a diferencia del original, que
// no tenía esta restricción. Un recibo sin cobros todavía se puede borrar
// sin restricción, igual que antes.
export async function deleteRecibo(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const recibo = await Recibo.findById(id);
    if (!recibo) {
      return { ok: false, error: "El recibo ya no existe." };
    }
    if (recibo.pagos.length > 0) {
      return {
        ok: false,
        error: "No se puede borrar un recibo con pagos registrados — queda como historial.",
      };
    }
    await Recibo.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteRecibo error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/recibos");
  return { ok: true };
}