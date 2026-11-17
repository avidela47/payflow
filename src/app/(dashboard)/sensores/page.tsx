import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { SensorFuente } from "@/models/SensorFuente";
import { SensoresClient, type SensorFuenteItem } from "./sensores-client";

export default async function SensoresPage() {
  await requireModuleAccess("sensores");
  await connectDB();

  const items = await SensorFuente.find({}).sort({ codigo: 1 }).lean();

  const sensorItems: SensorFuenteItem[] = items.map((item) => ({
    id: item._id.toString(),
    codigo: item.codigo,
    descripcion: item.descripcion,
    tipo: item.tipo,
    stockActual: item.stockActual,
    stockMinimo: item.stockMinimo,
    precio: item.precio,
    proveedor: item.proveedor,
    notas: item.notas,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Sensores y Fuentes</h1>
        <p className="text-sm text-muted-foreground">
          Stock de sensores, fuentes y accesorios de planta — primer módulo fusionado desde
          Gestión de Luminarias.
        </p>
      </div>

      <SensoresClient items={sensorItems} />
    </div>
  );
}