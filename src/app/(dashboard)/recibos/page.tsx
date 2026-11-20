import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { Presupuesto } from "@/models/Presupuesto";
import { Recibo } from "@/models/Recibo";
import {
  RecibosClient,
  type ReciboItem,
  type ClienteOption,
  type PresupuestoOption,
} from "./recibos-client";

export default async function RecibosPage() {
  await requireModuleAccess("recibos");
  await connectDB();

  const [items, clients, presupuestos] = await Promise.all([
    Recibo.find({}).sort({ createdAt: -1 }).lean(),
    Client.find({}).sort({ nombre: 1 }).lean(),
    // Solo presupuestos aprobados, igual criterio que Despachos.
    Presupuesto.find({ estado: "APROBADO" }).sort({ createdAt: -1 }).lean(),
  ]);

  const reciboItems: ReciboItem[] = items.map((item) => ({
    id: item._id.toString(),
    numero: item.numero,
    fechaISO: item.fecha.toISOString().slice(0, 10),
    clientId: item.clientId?.toString(),
    razonSocial: item.razonSocial,
    numeroPresupuesto: item.numeroPresupuesto,
    numeroOrden: item.numeroOrden,
    concepto: item.concepto,
    lineas: item.lineas.map((l) => ({ descripcion: l.descripcion, montoUsd: l.montoUsd })),
    totalUsd: item.totalUsd,
    totalPagadoUsd: item.totalPagadoUsd,
    saldoUsd: item.saldoUsd,
    estado: item.estado,
    notas: item.notas,
    // Los pagos migrados desde Gestión de Luminarias se insertaron por
    // fuera de Mongoose (script directo a la colección), así que esos
    // subdocumentos no tienen _id propio — sin este respaldo, p._id.
    // toString() revienta toda la página en cuanto aparece el primero.
    pagos: item.pagos.map((p, i) => ({
      id: p._id ? p._id.toString() : `${item._id.toString()}-pago-${i}`,
      fechaISO: p.fecha.toISOString().slice(0, 10),
      montoUsd: p.montoUsd,
      tipoCambio: p.tipoCambio,
      montoPesos: p.montoPesos,
      formaPago: p.formaPago,
      notas: p.notas,
    })),
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
    total: p.total,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Recibos</h1>
        <p className="text-sm text-muted-foreground">
          Cobros a clientes en U$S — pagos parciales con su propio tipo de cambio a pesos cada uno.
        </p>
      </div>

      <RecibosClient items={reciboItems} clientes={clienteOptions} presupuestos={presupuestoOptions} />
    </div>
  );
}