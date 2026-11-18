import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Material } from "@/models/Material";
import { MaterialesClient, type MaterialItem } from "./materiales-client";

export default async function MaterialesPage() {
  await requireModuleAccess("materiales");
  await connectDB();

  const items = await Material.find({}).sort({ codigo: 1 }).lean();

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Materiales de Obra</h1>
        <p className="text-sm text-muted-foreground">
          Stock de materiales de obra para instalaciones — cuarto módulo fusionado desde Gestión
          de Luminarias.
        </p>
      </div>

      <MaterialesClient items={materialItems} />
    </div>
  );
}