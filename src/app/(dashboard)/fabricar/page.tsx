import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Receta } from "@/models/Receta";
import { Componente } from "@/models/Componente";
import { Produccion } from "@/models/Produccion";
import { FabricarClient, type RecetaFabricable, type ComponenteStock, type ProduccionItem } from "./fabricar-client";

export default async function FabricarPage() {
  await requireModuleAccess("fabricar");
  await connectDB();

  const [recetasDocs, componentesDocs, produccionesDocs] = await Promise.all([
    // Solo recetas activas y con componentes — mismo filtro que aplicaba el
    // propio formulario del original (ver app/(app)/fabricar/page.tsx de
    // Gestión de Luminarias).
    Receta.find({ activa: true, "componentes.0": { $exists: true } })
      .sort({ codigo: 1 })
      .lean(),
    Componente.find({}).select("codigo descripcion stockActual unidad").sort({ codigo: 1 }).lean(),
    // Historial de fabricaciones — ver nota en models/Produccion.ts: el
    // original guarda esto pero nunca lo muestra en ninguna pantalla real.
    Produccion.find({}).sort({ createdAt: -1 }).limit(100).lean(),
  ]);

  const recetas: RecetaFabricable[] = recetasDocs.map((r) => ({
    codigo: r.codigo,
    nombre: r.nombre,
    version: r.version,
    componentes: r.componentes.map((c) => ({
      componenteId: c.componenteId.toString(),
      codigoComponente: c.codigoComponente,
      descripcionComponente: c.descripcionComponente,
      cantidad: c.cantidad,
    })),
  }));

  const componentes: ComponenteStock[] = componentesDocs.map((c) => ({
    id: c._id.toString(),
    codigo: c.codigo,
    descripcion: c.descripcion,
    stockActual: c.stockActual,
    unidad: c.unidad,
  }));

  const producciones: ProduccionItem[] = produccionesDocs.map((p) => ({
    id: p._id.toString(),
    numero: p.numero,
    codigoLuminaria: p.codigoLuminaria,
    nombreLuminaria: p.nombreLuminaria,
    versionReceta: p.versionReceta,
    cantidad: p.cantidad,
    operario: p.operario,
    notas: p.notas,
    createdAtISO: p.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Fabricar</h1>
        <p className="text-sm text-muted-foreground">
          Registrá una producción y el sistema descuenta el stock de Componentes y suma stock de
          Luminaria Fabricada automáticamente, según la Receta.
        </p>
      </div>

      <FabricarClient recetas={recetas} componentes={componentes} producciones={producciones} />
    </div>
  );
}
