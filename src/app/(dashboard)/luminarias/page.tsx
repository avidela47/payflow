import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Luminaria } from "@/models/Luminaria";
import { LuminariasClient, type LuminariaItem } from "./luminarias-client";

export default async function LuminariasPage() {
  await requireModuleAccess("luminarias");
  await connectDB();

  const items = await Luminaria.find({}).sort({ codigo: 1 }).lean();

  const luminariaItems: LuminariaItem[] = items.map((item) => ({
    id: item._id.toString(),
    codigo: item.codigo,
    descripcion: item.descripcion,
    origen: item.origen,
    stockActual: item.stockActual,
    stockMinimo: item.stockMinimo,
    precio: item.precio,
    proveedor: item.proveedor,
    notas: item.notas,
    tieneReceta: item.tieneReceta,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Luminarias</h1>
        <p className="text-sm text-muted-foreground">
          Stock de luminarias fabricadas e importadas/depósito — segundo módulo fusionado desde
          Gestión de Luminarias.
        </p>
      </div>

      <LuminariasClient items={luminariaItems} />
    </div>
  );
}