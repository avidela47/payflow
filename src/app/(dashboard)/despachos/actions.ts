"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Despacho } from "@/models/Despacho";
import { Luminaria } from "@/models/Luminaria";
import { LUMINARIA_ORIGENES } from "@/lib/luminaria-origen";

function generarNumero(): Promise<string> {
  return Despacho.findOne()
    .sort({ createdAt: -1 })
    .then((ultimo) => {
      const anio = new Date().getFullYear();
      if (!ultimo?.numero) return `DESP-${anio}-0001`;
      const partes = ultimo.numero.split("-");
      const num = parseInt(partes[2] || "0", 10) + 1;
      return `DESP-${anio}-${String(num).padStart(4, "0")}`;
    });
}

const itemSchema = z.object({
  codigo: z.string().min(1, "Falta el código de un ítem."),
  descripcion: z.string().min(1, "Falta la descripción de un ítem."),
  origen: z.enum(LUMINARIA_ORIGENES),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  precioUnitario: z.coerce.number().optional(),
});

const despachoSchema = z.object({
  fecha: z.coerce.date(),
  clientId: z.string().optional(),
  razonSocial: z.string().min(1, "Falta el cliente."),
  presupuestoId: z.string().optional(),
  numeroPresupuesto: z.string().optional(),
  observaciones: z.string().optional(),
  items: z.array(itemSchema).min(1, "Agregá al menos un ítem."),
});

function parseDespachoForm(formData: FormData) {
  let itemsRaw: unknown = [];
  try {
    itemsRaw = JSON.parse((formData.get("itemsJson") as string) || "[]");
  } catch {
    itemsRaw = [];
  }

  return despachoSchema.safeParse({
    fecha: formData.get("fecha") || new Date(),
    clientId: formData.get("clientId") || undefined,
    razonSocial: formData.get("razonSocial"),
    presupuestoId: formData.get("presupuestoId") || undefined,
    numeroPresupuesto: formData.get("numeroPresupuesto") || undefined,
    observaciones: formData.get("observaciones") || undefined,
    items: itemsRaw,
  });
}

// Crear un despacho NO mueve stock — queda "PENDIENTE" hasta que se
// confirma la entrega. Ver nota en models/Despacho.ts.
export async function createDespacho(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseDespachoForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const numero = await generarNumero();
    await Despacho.create({ ...parsed.data, numero });
  } catch (err) {
    console.error("createDespacho error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/despachos");
  return { ok: true };
}

// Confirmar entrega: acá se descuenta el stock de Luminaria (código +
// origen), no antes. Si falta stock de algún ítem, no confirma nada (todo
// o nada) y devuelve el detalle de qué falta, igual que hacía el modal
// del original.
export async function confirmarDespacho(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const despacho = await Despacho.findById(id);
    if (!despacho) {
      return { ok: false, error: "El despacho ya no existe." };
    }
    if (despacho.estado !== "PENDIENTE") {
      return { ok: false, error: "El despacho ya fue procesado." };
    }

    const faltantes: string[] = [];
    for (const item of despacho.items) {
      const lum = await Luminaria.findOne({ codigo: item.codigo, origen: item.origen });
      if (!lum || lum.stockActual < item.cantidad) {
        faltantes.push(
          `${item.codigo} (${item.origen}) — necesitás ${item.cantidad}, hay ${lum?.stockActual ?? 0}`
        );
      }
    }
    if (faltantes.length > 0) {
      return { ok: false, error: `Stock insuficiente: ${faltantes.join("; ")}` };
    }

    for (const item of despacho.items) {
      await Luminaria.findOneAndUpdate(
        { codigo: item.codigo, origen: item.origen },
        { $inc: { stockActual: -item.cantidad } }
      );
    }

    despacho.estado = "DESPACHADO";
    despacho.fecha = new Date();
    await despacho.save();
  } catch (err) {
    console.error("confirmarDespacho error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo confirmar: ${message}` };
  }

  revalidatePath("/despachos");
  revalidatePath("/luminarias");
  return { ok: true };
}

// Anular: solo desde DESPACHADO (igual que el original) — restaura stock
// de TODOS los ítems, a diferencia del original que en los hechos no
// restauraba nada (ver nota en models/Despacho.ts).
export async function anularDespacho(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const despacho = await Despacho.findById(id);
    if (!despacho) {
      return { ok: false, error: "El despacho ya no existe." };
    }
    if (despacho.estado !== "DESPACHADO") {
      return { ok: false, error: "Solo se pueden anular despachos confirmados." };
    }

    for (const item of despacho.items) {
      await Luminaria.findOneAndUpdate(
        { codigo: item.codigo, origen: item.origen },
        { $inc: { stockActual: item.cantidad } }
      );
    }

    despacho.estado = "ANULADO";
    await despacho.save();
  } catch (err) {
    console.error("anularDespacho error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo anular: ${message}` };
  }

  revalidatePath("/despachos");
  revalidatePath("/luminarias");
  return { ok: true };
}

// Borrar: solo mientras está PENDIENTE (todavía no movió stock). Uno ya
// DESPACHADO o ANULADO se anula/se deja como registro, no se borra.
export async function deleteDespacho(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const despacho = await Despacho.findById(id);
    if (!despacho) {
      return { ok: false, error: "El despacho ya no existe." };
    }
    if (despacho.estado !== "PENDIENTE") {
      return { ok: false, error: "Solo se puede borrar un despacho pendiente — uno ya confirmado se anula." };
    }
    await Despacho.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteDespacho error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/despachos");
  return { ok: true };
}