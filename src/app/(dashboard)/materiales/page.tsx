import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Material } from "@/models/Material";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import { MaterialesClient, type MaterialItem, type OrdenTrabajoOption } from "./materiales-client";

export default async function MaterialesPage() {
  await requireModuleAccess("materiales");
  await connectDB();

  const [items, ordenes] = await Promise.all([
    Material.find({}).sort({ codigo: 1 }).lean(),
    OrdenTrabajo.find({}).sort({ createdAt: -1 }).select("numero razonSocial").lean(),
  ]);

  const materialItems: MaterialItem[] = items.map((item) => ({
    id: item._id.toString(),
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    stockActual: item.stockActual,
    stockMinimo: item.stockMinimo,
    precio: item.precio,
    proveedor: item.proveedor,
    notas: item.notas,
  }));

  const ordenTrabajoOptions: OrdenTrabajoOption[] = ordenes.map((o) => ({
    id: o._id.toString(),
    numero: o.numero,
    razonSocial: o.razonSocial,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Materiales de Obra</h1>
        <p className="text-sm text-muted-foreground">
          Stock de materiales de obra para instalaciones — cuarto módulo fusionado desde Gestión
          de Luminarias.
        </p>
      </div>

      <MaterialesClient items={materialItems} ordenesTrabajo={ordenTrabajoOptions} />
    </div>
  );
}