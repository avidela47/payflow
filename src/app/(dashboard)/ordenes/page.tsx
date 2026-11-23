import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { Presupuesto } from "@/models/Presupuesto";
import { OrdenTrabajo } from "@/models/OrdenTrabajo";
import {
  OrdenesClient,
  type OrdenItem,
  type ClienteOption,
  type PresupuestoOption,
} from "./ordenes-client";

export default async function OrdenesPage() {
  await requireModuleAccess("ordenes");
  await connectDB();

  const [items, clients, presupuestos] = await Promise.all([
    OrdenTrabajo.find({}).sort({ createdAt: -1 }).lean(),
    Client.find({}).sort({ nombre: 1 }).lean(),
    Presupuesto.find({ estado: "APROBADO" }).sort({ createdAt: -1 }).lean(),
  ]);

  const ordenItems: OrdenItem[] = items.map((item) => ({
    id: item._id.toString(),
    numero: item.numero,
    fechaISO: item.fecha.toISOString().slice(0, 10),
    clienteId: item.clienteId?.toString(),
    razonSocial: item.razonSocial,
    numeroPresupuesto: item.numeroPresupuesto,
    lineas: item.lineas.map((l) => ({
      codigoLuminaria: l.codigoLuminaria,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
    })),
    estado: item.estado,
    ejecutada: item.ejecutada,
    proyectoFabricaId: item.proyectoFabricaId?.toString(),
    notas: item.notas,
  }));

  const clienteOptions: ClienteOption[] = clients.map((c) => ({
    id: c._id.toString(),
    nombre: c.nombre,
    razonSocial: c.razonSocial || c.nombre,
  }));

  const presupuestoOptions: PresupuestoOption[] = presupuestos.map((p) => ({
    id: p._id.toString(),
    numero: p.numero,
    clienteId: p.clientId?.toString(),
    razonSocial: p.razonSocial,
    lineas: p.lineas.map((l) => ({
      codigo: l.codigo,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
    })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Órdenes de Trabajo</h1>
        <p className="text-sm text-muted-foreground">
          Al ejecutar una orden, PayFlow calcula qué hay en stock y genera automáticamente un
          Proyecto de fábrica con lo que falta.
        </p>
      </div>

      <OrdenesClient items={ordenItems} clientes={clienteOptions} presupuestos={presupuestoOptions} />
    </div>
  );
}
