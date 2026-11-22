import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Componente } from "@/models/Componente";
import { ComponentesClient, type ComponenteItem } from "./componentes-client";

export default async function ComponentesPage() {
  await requireModuleAccess("componentes");
  await connectDB();

  const items = await Componente.find({}).sort({ codigo: 1 }).lean();

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