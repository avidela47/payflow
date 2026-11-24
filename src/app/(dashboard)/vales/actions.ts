"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Vale } from "@/models/Vale";
import { VALE_ITEM_TIPOS } from "@/lib/vale-estados";
import { getNextSequence } from "@/models/Counter";

async function generarNumeroVale(): Promise<string> {
  const seq = await getNextSequence("vale");
  return `VALE-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

const itemSchema = z.object({
  descripcion: z.string().min(1, "Falta la descripción de un ítem."),
  cantidadSalida: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  tipo: z.enum(VALE_ITEM_TIPOS),
  notas: z.string().optional(),
});

const valeSchema = z.object({
  fechaSalida: z.coerce.date(),
  responsable: z.string().min(1, "Falta el responsable."),
  observacionesSalida: z.string().optional(),
  items: z.array(itemSchema).min(1, "Agregá al menos un ítem."),
});

function parseValeForm(formData: FormData) {
  let itemsRaw: unknown = [];
  try {
    itemsRaw = JSON.parse((formData.get("itemsJson") as string) || "[]");
  } catch {
    itemsRaw = [];
  }

  return valeSchema.safeParse({
    fechaSalida: formData.get("fechaSalida") || new Date(),
    responsable: formData.get("responsable"),
    observacionesSalida: formData.get("observacionesSalida") || undefined,
    items: itemsRaw,
  });
}

// Crear un vale NO mueve stock de ningún catálogo — es una ficha de
// control pura (ver nota en models/Vale.ts sobre por qué se descartó la
// lógica de descuento automático del original).
export async function createVale(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parseValeForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    const numero = await generarNumeroVale();
    await Vale.create({
      numero,
      fechaSalida: parsed.data.fechaSalida,
      responsable: parsed.data.responsable,
      emitidoPor: session.user.name || session.user.email || "",
      observacionesSalida: parsed.data.observacionesSalida || "",
      items: parsed.data.items.map((i) => ({ ...i, cantidadDevuelta: 0 })),
    });
  } catch (err) {
    console.error("createVale error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear: ${message}` };
  }

  revalidatePath("/vales");
  return { ok: true };
}

const devolucionSchema = z.object({
  cantidades: z.array(z.coerce.number().min(0)),
  observacionesDevolucion: z.string().optional(),
});

// Registrar devolución: parcial o total, por ítem. El estado se recalcula
// siempre a partir de los ítems ya actualizados — nunca se elige a mano.
// No toca stock de ningún catálogo (ver nota en models/Vale.ts): si algo
// no vuelve, queda registrado acá como diferencia, y si hace falta
// reponerlo de verdad, se ajusta a mano desde Movimientos de Componentes.
export async function registrarDevolucionVale(
  id: string,
  cantidadesJson: string,
  observacionesDevolucion: string
) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  let cantidadesRaw: unknown;
  try {
    cantidadesRaw = JSON.parse(cantidadesJson);
  } catch {
    return { ok: false, error: "Cantidades inválidas." };
  }
  const parsed = devolucionSchema.safeParse({
    cantidades: cantidadesRaw,
    observacionesDevolucion: observacionesDevolucion || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Cantidades inválidas." };
  }

  try {
    await connectDB();
    const vale = await Vale.findById(id);
    if (!vale) {
      return { ok: false, error: "El vale ya no existe." };
    }
    if (vale.estado === "CERRADO") {
      return { ok: false, error: "El vale ya está cerrado." };
    }
    if (parsed.data.cantidades.length !== vale.items.length) {
      return { ok: false, error: "Las cantidades no coinciden con los ítems del vale." };
    }

    const total = parsed.data.cantidades.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      return { ok: false, error: "Ingresá al menos una cantidad devuelta." };
    }

    const faltantes: string[] = [];
    vale.items.forEach((item, i) => {
      const pendiente = item.cantidadSalida - item.cantidadDevuelta;
      if (parsed.data.cantidades[i] > pendiente) {
        faltantes.push(`"${item.descripcion}": no se puede devolver más de lo pendiente (${pendiente}).`);
      }
    });
    if (faltantes.length > 0) {
      return { ok: false, error: faltantes.join(" ") };
    }

    const itemsActualizados = vale.items.map((item, i) => ({
      descripcion: item.descripcion,
      cantidadSalida: item.cantidadSalida,
      cantidadDevuelta: item.cantidadDevuelta + parsed.data.cantidades[i],
      tipo: item.tipo,
      notas: item.notas,
    }));

    const todoCerrado = itemsActualizados.every((item) => item.cantidadDevuelta >= item.cantidadSalida);
    const algoDevuelto = itemsActualizados.some((item) => item.cantidadDevuelta > 0);
    const nuevoEstado = todoCerrado ? "CERRADO" : algoDevuelto ? "DEVOLUCION_PARCIAL" : "ABIERTO";

    await Vale.findByIdAndUpdate(id, {
      $set: {
        items: itemsActualizados,
        estado: nuevoEstado,
        fechaDevolucion: new Date(),
        observacionesDevolucion: parsed.data.observacionesDevolucion || vale.observacionesDevolucion || "",
      },
    });
  } catch (err) {
    console.error("registrarDevolucionVale error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo registrar la devolución: ${message}` };
  }

  revalidatePath("/vales");
  return { ok: true };
}

// Borrar: solo mientras está ABIERTO o DEVOLUCION_PARCIAL — uno ya
// CERRADO queda como registro, no se borra. En el original esta
// restricción solo vivía en la UI (el botón "Eliminar" se ocultaba para
// un vale cerrado, pero el endpoint lo hubiera borrado igual si se lo
// llamaba directo) — acá se refuerza también del lado del servidor, mismo
// criterio que ya se aplica en Reparación/OT/Despacho.
export async function deleteVale(id: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const vale = await Vale.findById(id);
    if (!vale) {
      return { ok: false, error: "El vale ya no existe." };
    }
    if (vale.estado === "CERRADO") {
      return { ok: false, error: "No se puede borrar un vale cerrado — queda como registro." };
    }
    await Vale.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteVale error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar: ${message}` };
  }

  revalidatePath("/vales");
  return { ok: true };
}
