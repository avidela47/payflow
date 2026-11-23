import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { Presupuesto } from "@/models/Presupuesto";
import { Reparacion } from "@/models/Reparacion";
import {
  ReparacionesClient,
  type ReparacionItem,
  type ClienteOption,
  type PresupuestoOption,
} from "./reparaciones-client";

export default async function ReparacionesPage() {
  await requireModuleAccess("reparaciones");
  await connectDB();

  const [items, clients, presupuestos] = await Promise.all([
    Reparacion.find({}).sort({ createdAt: -1 }).lean(),
    Client.find({}).sort({ nombre: 1 }).lean(),
    Presupuesto.find({ estado: "APROBADO" }).sort({ createdAt: -1 }).lean(),
  ]);

  const reparacionItems: ReparacionItem[] = items.map((item) => ({
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
        <h1 className="text-2xl font-semibold">Reparaciones</h1>
        <p className="text-sm text-muted-foreground">
          Luminarias del cliente que entran a reparar desde un presupuesto aprobado. Al ejecutar se
          descuenta a mano el stock de Componentes usado — la luminaria en sí nunca es stock de
          ITELSA.
        </p>
      </div>

      <ReparacionesClient items={reparacionItems} clientes={clienteOptions} presupuestos={presupuestoOptions} />
    </div>
  );
}
