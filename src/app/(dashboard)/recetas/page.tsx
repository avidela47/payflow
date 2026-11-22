import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Receta } from "@/models/Receta";
import { Componente } from "@/models/Componente";
import { RecetasClient, type RecetaItem, type ComponenteOpcion } from "./recetas-client";

export default async function RecetasPage() {
  await requireModuleAccess("recetas");
  await connectDB();

  const [items, componentes] = await Promise.all([
    Receta.find({}).sort({ codigo: 1 }).lean(),
    Componente.find({}).select("codigo descripcion unidad foto").sort({ codigo: 1 }).lean(),
  ]);

  const recetaItems: RecetaItem[] = items.map((item) => ({
    id: item._id.toString(),
    codigo: item.codigo,
    nombre: item.nombre,
    version: item.version,
    fechaVersionISO: item.fechaVersion.toISOString(),
    activa: item.activa,
    componentes: item.componentes.map((c) => ({
      componenteId: c.componenteId.toString(),
      codigoComponente: c.codigoComponente,
      descripcionComponente: c.descripcionComponente,
      cantidad: c.cantidad,
    })),
    notas: item.notas,
    foto: item.foto,
  }));

  const opcionesComponentes: ComponenteOpcion[] = componentes.map((c) => ({
    id: c._id.toString(),
    codigo: c.codigo,
    descripcion: c.descripcion,
    unidad: c.unidad,
    foto: c.foto,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Recetas (BOM)</h1>
        <p className="text-sm text-muted-foreground">
          Composición de Componentes por Luminaria — sexto módulo fusionado desde Gestión de
          Luminarias (Fase 5, Producción).
        </p>
      </div>

      <RecetasClient items={recetaItems} opcionesComponentes={opcionesComponentes} />
    </div>
  );
}
