import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Componente } from "@/models/Componente";
import { MovimientoComponente } from "@/models/MovimientoComponente";
import {
  MovimientosComponentesClient,
  type MovimientoItem,
  type ComponenteOption,
} from "./movimientos-componentes-client";

// Pantalla separada de /componentes, igual que en Gestión de Luminarias
// (ahí "Movimientos" también es su propia pantalla, no botones metidos en
// la tabla de Componentes — corregido el 2026-11-22 después de comparar
// con la pantalla real).
export default async function MovimientosComponentesPage() {
  await requireModuleAccess("movimientos-componentes");
  await connectDB();

  const [componentes, movimientos] = await Promise.all([
    Componente.find({}).sort({ codigo: 1 }).lean(),
    MovimientoComponente.find({}).sort({ createdAt: -1 }).lean(),
  ]);

  const componenteOptions: ComponenteOption[] = componentes.map((c) => ({
    id: c._id.toString(),
    codigo: c.codigo,
    descripcion: c.descripcion,
    unidad: c.unidad,
    stockActual: c.stockActual,
  }));

  const movimientoItems: MovimientoItem[] = movimientos.map((m) => ({
    id: m._id.toString(),
    componenteId: m.componenteId.toString(),
    codigoComponente: m.codigoComponente,
    descripcionComponente: m.descripcionComponente,
    tipo: m.tipo,
    cantidad: m.cantidad,
    stockResultante: m.stockResultante,
    referencia: m.referencia,
    notas: m.notas,
    usuario: m.usuario,
    createdAtISO: m.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Movimientos de Componentes</h1>
        <p className="text-sm text-muted-foreground">
          Historial completo de entradas y ajustes de stock de Componentes.
        </p>
      </div>

      <MovimientosComponentesClient componentes={componenteOptions} movimientos={movimientoItems} />
    </div>
  );
}