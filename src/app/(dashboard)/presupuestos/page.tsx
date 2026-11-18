import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Client } from "@/models/Client";
import { Presupuesto } from "@/models/Presupuesto";
import { PresupuestosClient, type PresupuestoItem, type ClienteOption } from "./presupuestos-client";

export default async function PresupuestosPage() {
  await requireModuleAccess("presupuestos");
  await connectDB();

  const [items, clients] = await Promise.all([
    Presupuesto.find({}).sort({ createdAt: -1 }).lean(),
    Client.find({}).sort({ nombre: 1 }).lean(),
  ]);

  const presupuestoItems: PresupuestoItem[] = items.map((item) => ({
    id: item._id.toString(),
    numero: item.numero,
    fechaISO: item.fecha.toISOString().slice(0, 10),
    validezDias: item.validezDias,
    vendedor: item.vendedor,
    clientId: item.clientId?.toString(),
    razonSocial: item.razonSocial,
    cuit: item.cuit,
    direccion: item.direccion,
    localidad: item.localidad,
    telefono: item.telefono,
    email: item.email,
    atencion: item.atencion,
    condicionIva: item.condicionIva,
    lineas: item.lineas.map((l) => ({
      codigo: l.codigo,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      bonificacion: l.bonificacion,
      precioUnitario: l.precioUnitario,
      precioTotal: l.precioTotal,
      plazoEntregaLinea: l.plazoEntregaLinea,
    })),
    moneda: item.moneda,
    subtotal: item.subtotal,
    iva: item.iva,
    total: item.total,
    formaPago: item.formaPago,
    plazoEntrega: item.plazoEntrega,
    cotizacion: item.cotizacion,
    comentario: item.comentario,
    estado: item.estado,
    notas: item.notas,
  }));

  const clienteOptions: ClienteOption[] = clients.map((c) => ({
    id: c._id.toString(),
    nombre: c.nombre,
    razonSocial: c.razonSocial,
    cuit: c.cuit,
    direccion: c.direccion,
    localidad: c.localidad,
    telefono: c.telefono,
    email: c.email,
    condicionIva: c.condicionIva,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Presupuestos</h1>
        <p className="text-sm text-muted-foreground">
          Cotizaciones a clientes — primer módulo de Comercial fusionado desde Gestión de
          Luminarias.
        </p>
      </div>

      <PresupuestosClient items={presupuestoItems} clientes={clienteOptions} />
    </div>
  );
}