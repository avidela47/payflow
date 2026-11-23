import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { Presupuesto } from "@/models/Presupuesto";
import { Remito } from "@/models/Remito";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import {
  RemitosClient,
  type RemitoItem,
  type ClienteOption,
  type PresupuestoOption,
  type OrdenTrabajoOption,
} from "./remitos-client";

export default async function RemitosPage() {
  await requireModuleAccess("remitos");
  await connectDB();

  const [items, clients, presupuestos, ordenes] = await Promise.all([
    Remito.find({}).sort({ createdAt: -1 }).lean(),
    Client.find({}).sort({ nombre: 1 }).lean(),
    Presupuesto.find({}).sort({ createdAt: -1 }).lean(),
    OrdenTrabajo.find({}).sort({ createdAt: -1 }).select("numero razonSocial").lean(),
  ]);

  const remitoItems: RemitoItem[] = items.map((item) => ({
    id: item._id.toString(),
    numero: item.numero,
    fechaISO: item.fecha.toISOString().slice(0, 10),
    clientId: item.clientId?.toString(),
    razonSocial: item.razonSocial,
    numeroPresupuesto: item.numeroPresupuesto,
    numeroOrden: item.numeroOrden,
    lineas: item.lineas.map((l) => ({
      codigo: l.codigo,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      unidad: l.unidad,
    })),
    notas: item.notas,
    estado: item.estado,
  }));

  const clienteOptions: ClienteOption[] = clients.map((c) => ({
    id: c._id.toString(),
    nombre: c.nombre,
    razonSocial: c.razonSocial,
  }));

  const presupuestoOptions: PresupuestoOption[] = presupuestos.map((p) => ({
    id: p._id.toString(),
    numero: p.numero,
    clientId: p.clientId?.toString(),
    razonSocial: p.razonSocial,
    lineas: p.lineas.map((l) => ({ codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad })),
  }));

  const ordenTrabajoOptions: OrdenTrabajoOption[] = ordenes.map((o) => ({
    id: o._id.toString(),
    numero: o.numero,
    razonSocial: o.razonSocial,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Remitos</h1>
        <p className="text-sm text-muted-foreground">
          Documentos de entrega de mercadería — segundo módulo de Comercial Planta fusionado desde
          Gestión de Luminarias.
        </p>
      </div>

      <RemitosClient
        items={remitoItems}
        clientes={clienteOptions}
        presupuestos={presupuestoOptions}
        ordenesTrabajo={ordenTrabajoOptions}
      />
    </div>
  );
}