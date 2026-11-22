import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Componente } from "@/models/Componente";
import { MovimientoComponente } from "@/models/MovimientoComponente";
import { Receta } from "@/models/Receta";
import { ComponentesClient, type ComponenteItem } from "./componentes-client";

export default async function ComponentesPage() {
  await requireModuleAccess("componentes");
  await connectDB();

  const items = await Componente.find({}).sort({ codigo: 1 }).lean();

  // Para saber qué componentes tienen historial o están usados en una
  // Receta, y deshabilitarles el botón de borrar (ver actions.ts,
  // deleteComponente) sin una consulta por fila.
  const idsConMovimientos = new Set(
    (await MovimientoComponente.distinct("componenteId")).map((id) => id.toString())
  );
  const idsEnReceta = new Set(
    (await Receta.distinct("componentes.componenteId")).map((id) => id.toString())
  );

  const componenteItems: ComponenteItem[] = items.map((item) => ({
    id: item._id.toString(),
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    stockActual: item.stockActual,
    stockMinimo: item.stockMinimo,
    precio: item.precio,
    proveedor: item.proveedor,
    ubicacion: item.ubicacion,
    notas: item.notas,
    foto: item.foto,
    tieneMovimientos: idsConMovimientos.has(item._id.toString()),
    enReceta: idsEnReceta.has(item._id.toString()),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Componentes</h1>
        <p className="text-sm text-muted-foreground">
          Piezas con las que se fabrican las Luminarias — quinto módulo fusionado desde Gestión de
          Luminarias (Fase 5, Producción).
        </p>
      </div>

      <ComponentesClient items={componenteItems} />
    </div>
  );
}
