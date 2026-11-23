"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Receta } from "@/models/Receta";
import { Componente } from "@/models/Componente";
import { MovimientoComponente } from "@/models/MovimientoComponente";
import { Luminaria } from "@/models/Luminaria";
import { Produccion } from "@/models/Produccion";
import { getNextSequence } from "@/models/Counter";

// Numeración propia para el historial de fabricación — ver nota en
// models/Produccion.ts (reemplaza el `Date.now()` del original por el
// contador atómico que ya usa PayFlow para Presupuestos).
async function generarNumeroProduccion(): Promise<string> {
  const seq = await getNextSequence("produccion");
  const anio = new Date().getFullYear();
  return `PROD-${anio}-${String(seq).padStart(4, "0")}`;
}

const fabricarSchema = z.object({
  codigoReceta: z.string().min(1, "Falta elegir la luminaria a fabricar."),
  cantidad: z.coerce.number().int("La cantidad tiene que ser un número entero.").positive("La cantidad debe ser mayor a 0."),
  notas: z.string().optional(),
});

// Fabricar: consume Componentes según la Receta de la Luminaria elegida y
// genera stock de Luminaria FABRICADA. Mismo criterio "todo o nada" que
// Despachos/confirmarDespacho — si falta stock de algún componente, no se
// descuenta ni se registra nada. La validación de stock vuelve a hacerse
// acá con datos recién leídos de la base (no se confía en lo que mandó el
// formulario), igual que hacía el original en su API route — lo que ve el
// usuario en "Verificar stock" es solo una previsualización.
export async function confirmarFabricacion(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = fabricarSchema.safeParse({
    codigoReceta: formData.get("codigoReceta"),
    cantidad: formData.get("cantidad"),
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { codigoReceta, cantidad, notas } = parsed.data;

  try {
    await connectDB();

    const receta = await Receta.findOne({ codigo: codigoReceta.toUpperCase(), activa: true });
    if (!receta) {
      return { ok: false, error: "La receta no existe o está inactiva." };
    }
    if (receta.componentes.length === 0) {
      return { ok: false, error: "Esta receta no tiene componentes cargados." };
    }

    // 1. Validar stock de cada componente con datos recién leídos.
    const faltantes: string[] = [];
    const lineas: { componenteId: string; codigo: string; descripcion: string; necesario: number; stockActual: number }[] = [];
    for (const item of receta.componentes) {
      const componente = await Componente.findById(item.componenteId);
      const necesario = item.cantidad * cantidad;
      if (!componente) {
        faltantes.push(`${item.codigoComponente} (ya no existe)`);
        continue;
      }
      if (componente.stockActual < necesario) {
        faltantes.push(
          `${componente.codigo} — necesitás ${necesario}, hay ${componente.stockActual}`
        );
      }
      lineas.push({
        componenteId: componente._id.toString(),
        codigo: componente.codigo,
        descripcion: componente.descripcion,
        necesario,
        stockActual: componente.stockActual,
      });
    }
    if (faltantes.length > 0) {
      return { ok: false, error: `Stock insuficiente: ${faltantes.join("; ")}` };
    }

    // 2. Descontar componentes y registrar el movimiento de cada uno.
    const numero = await generarNumeroProduccion();
    const operario = session.user.name || session.user.email || "";
    const componentesDescontados = [];

    for (const linea of lineas) {
      const actualizado = await Componente.findByIdAndUpdate(
        linea.componenteId,
        { $inc: { stockActual: -linea.necesario } },
        { new: true }
      );
      componentesDescontados.push({
        componenteId: linea.componenteId,
        codigoComponente: linea.codigo,
        descripcionComponente: linea.descripcion,
        cantidad: linea.necesario,
      });
      await MovimientoComponente.create({
        componenteId: linea.componenteId,
        codigoComponente: linea.codigo,
        descripcionComponente: linea.descripcion,
        tipo: "SALIDA_PRODUCCION",
        cantidad: linea.necesario,
        stockResultante: actualizado!.stockActual,
        referencia: numero,
        notas: `Fabricación ${receta.codigo} x${cantidad}`,
        usuario: operario,
      });
    }

    // 3. Sumar stock de la Luminaria FABRICADA correspondiente (la crea si
    // todavía no existe un registro de stock para ese código con ese
    // origen — ver nota "tieneReceta" en models/Luminaria.ts).
    const luminariaExistente = await Luminaria.findOne({ codigo: receta.codigo, origen: "FABRICADA" });
    if (luminariaExistente) {
      await Luminaria.findByIdAndUpdate(luminariaExistente._id, {
        $inc: { stockActual: cantidad },
        $set: { tieneReceta: true },
      });
    } else {
      await Luminaria.create({
        codigo: receta.codigo,
        descripcion: receta.nombre,
        origen: "FABRICADA",
        stockActual: cantidad,
        stockMinimo: 0,
        precio: 0,
        tieneReceta: true,
      });
    }

    // 4. Dejar registro de la fabricación (historial, ver nota en
    // models/Produccion.ts).
    await Produccion.create({
      numero,
      codigoLuminaria: receta.codigo,
      nombreLuminaria: receta.nombre,
      versionReceta: receta.version,
      cantidad,
      operario,
      notas: notas || "",
      componentesDescontados,
    });
  } catch (err) {
    console.error("confirmarFabricacion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo registrar la fabricación: ${message}` };
  }

  revalidatePath("/fabricar");
  revalidatePath("/componentes");
  revalidatePath("/movimientos-componentes");
  revalidatePath("/luminarias");
  return { ok: true };
}
