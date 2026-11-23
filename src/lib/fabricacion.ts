import { connectDB } from "@/lib/db";
import { Receta } from "@/models/Receta";
import { Componente } from "@/models/Componente";
import { MovimientoComponente } from "@/models/MovimientoComponente";
import { Luminaria } from "@/models/Luminaria";
import { Produccion } from "@/models/Produccion";
import { getNextSequence } from "@/models/Counter";

// Núcleo real de "fabricar": descuenta Componentes según la Receta, suma
// stock de Luminaria FABRICADA, y deja registro en Produccion. Extraído de
// fabricar/actions.ts (2026-11-23) porque Proyecto de fábrica necesita
// exactamente esta misma operación — en el original, "Fabricar" (una
// unidad a la vez) y "cargar avance" de un Proyecto (ver
// app/api/proyectos/[id]/avance/route.ts de Gestión de Luminarias) son,
// de hecho, el mismo bloque de código copiado dos veces. Acá se factoriza
// una sola vez — si el criterio de descuento cambia, cambia en los dos
// lugares a la vez, no hay que acordarse de tocar dos copias.
export type ResultadoFabricacion =
  | { ok: true; produccionId: string; numero: string }
  | { ok: false; error: string };

export async function ejecutarFabricacion(params: {
  codigoReceta: string;
  cantidad: number;
  operario: string;
  notas?: string;
}): Promise<ResultadoFabricacion> {
  const { codigoReceta, cantidad, operario, notas } = params;

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
  const lineas: {
    componenteId: string;
    codigo: string;
    descripcion: string;
    necesario: number;
  }[] = [];
  for (const item of receta.componentes) {
    const componente = await Componente.findById(item.componenteId);
    const necesario = item.cantidad * cantidad;
    if (!componente) {
      faltantes.push(`${item.codigoComponente} (ya no existe)`);
      continue;
    }
    if (componente.stockActual < necesario) {
      faltantes.push(`${componente.codigo} — necesitás ${necesario}, hay ${componente.stockActual}`);
    }
    lineas.push({
      componenteId: componente._id.toString(),
      codigo: componente.codigo,
      descripcion: componente.descripcion,
      necesario,
    });
  }
  if (faltantes.length > 0) {
    return { ok: false, error: `Stock insuficiente: ${faltantes.join("; ")}` };
  }

  // 2. Descontar componentes y registrar el movimiento de cada uno.
  const seq = await getNextSequence("produccion");
  const numero = `PROD-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
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

  // 3. Sumar stock de la Luminaria FABRICADA correspondiente.
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

  // 4. Dejar registro de la fabricación.
  const produccion = await Produccion.create({
    numero,
    codigoLuminaria: receta.codigo,
    nombreLuminaria: receta.nombre,
    versionReceta: receta.version,
    cantidad,
    operario,
    notas: notas || "",
    componentesDescontados,
  });

  return { ok: true, produccionId: produccion._id.toString(), numero };
}
