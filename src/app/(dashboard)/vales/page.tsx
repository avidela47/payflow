import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Vale } from "@/models/Vale";
import { ValesClient, type ValeItem } from "./vales-client";

export default async function ValesPage() {
  await requireModuleAccess("vales");
  await connectDB();

  const vales = await Vale.find({}).sort({ createdAt: -1 }).lean();

  const items: ValeItem[] = vales.map((v) => ({
    id: v._id.toString(),
    numero: v.numero,
    fechaSalidaISO: v.fechaSalida.toISOString().slice(0, 10),
    fechaDevolucionISO: v.fechaDevolucion ? v.fechaDevolucion.toISOString().slice(0, 10) : undefined,
    responsable: v.responsable,
    emitidoPor: v.emitidoPor,
    estado: v.estado,
    items: v.items.map((i) => ({
      descripcion: i.descripcion,
      cantidadSalida: i.cantidadSalida,
      cantidadDevuelta: i.cantidadDevuelta,
      tipo: i.tipo,
      notas: i.notas,
    })),
    observacionesSalida: v.observacionesSalida,
    observacionesDevolucion: v.observacionesDevolucion,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Vales</h1>
        <p className="text-sm text-muted-foreground">
          Control interno de salidas y devoluciones (herramientas, stock u otros ítems prestados).
          No mueve stock de ningún catálogo.
        </p>
      </div>

      <ValesClient items={items} />
    </div>
  );
}
