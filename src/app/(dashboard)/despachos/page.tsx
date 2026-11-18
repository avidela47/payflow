import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { Presupuesto } from "@/models/Presupuesto";
import { Luminaria } from "@/models/Luminaria";
import { Despacho } from "@/models/Despacho";
import {
  DespachosClient,
  type DespachoItem,
  type ClienteOption,
  type PresupuestoOption,
  type LuminariaOption,
} from "./despachos-client";

export default async function DespachosPage() {
  await requireModuleAccess("despachos");
  await connectDB();

  const [items, clients, presupuestos, luminarias] = await Promise.all([
    Despacho.find({}).sort({ createdAt: -1 }).lean(),
    Client.find({}).sort({ nombre: 1 }).lean(),
    // Solo presupuestos aprobados tiene sentido despachar, igual que el
    // original (que filtraba "estado === 'Aprobado'" en el combo).
    Presupuesto.find({ estado: "APROBADO" }).sort({ createdAt: -1 }).lean(),
    Luminaria.find({}).sort({ codigo: 1 }).lean(),
  ]);

  const despachoItems: DespachoItem[] = items.map((item) => ({
    id: item._id.toString(),
    numero: item.numero,
    fechaISO: item.fecha.toISOString().slice(0, 10),
    clientId: item.clientId?.toString(),
    razonSocial: item.razonSocial,
    numeroPresupuesto: item.numeroPresupuesto,
    items: item.items.map((i) => ({
      codigo: i.codigo,
      descripcion: i.descripcion,
      origen: i.origen,
      cantidad: i.cantidad,
    })),
    observaciones: item.observaciones,
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
    lineas: p.lineas.map((l) => ({
      codigo: l.codigo,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
    })),
  }));

  const luminariaOptions: LuminariaOption[] = luminarias.map((l) => ({
    codigo: l.codigo,
    descripcion: l.descripcion,
    origen: l.origen,
    stockActual: l.stockActual,
    precio: l.precio,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Despachos</h1>
        <p className="text-sm text-muted-foreground">
          Entrega de luminarias al cliente — descuenta stock de Luminarias al confirmar, lo
          restaura al anular. No interviene Sensores y Fuentes.
        </p>
      </div>

      <DespachosClient
        items={despachoItems}
        clientes={clienteOptions}
        presupuestos={presupuestoOptions}
        luminarias={luminariaOptions}
      />
    </div>
  );
}