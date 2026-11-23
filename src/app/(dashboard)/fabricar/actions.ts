"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { ejecutarFabricacion } from "@/lib/fabricacion";

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
  const operario = session.user.name || session.user.email || "";

  try {
    const resultado = await ejecutarFabricacion({ codigoReceta, cantidad, operario, notas });
    if (!resultado.ok) {
      return { ok: false, error: resultado.error };
    }
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
