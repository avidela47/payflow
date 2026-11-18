import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Herramienta } from "@/models/Herramienta";
import { HerramientasClient, type HerramientaItem } from "./herramientas-client";

export default async function HerramientasPage() {
  await requireModuleAccess("herramientas");
  await connectDB();

  const items = await Herramienta.find({}).sort({ codigo: 1 }).lean();

  const herramientaItems: HerramientaItem[] = items.map((item) => ({
    id: item._id.toString(),
    codigo: item.codigo,
    nombre: item.nombre,
    descripcion: item.descripcion,
    cantidadTotal: item.cantidadTotal,
    cantidadDisponible: item.cantidadDisponible,
    estado: item.estado,
    ubicacion: item.ubicacion,
    notas: item.notas,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Herramientas</h1>
        <p className="text-sm text-muted-foreground">
          Inventario de herramientas de planta — tercer módulo fusionado desde Gestión de
          Luminarias.
        </p>
      </div>

      <HerramientasClient items={herramientaItems} />
    </div>
  );
}