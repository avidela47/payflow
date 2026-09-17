import { connectDB } from "@/lib/db";
import { Client } from "@/models/Client";
import { ClientsClient, type ClientItem } from "./clientes-client";

export default async function ClientesPage() {
  await connectDB();

  const clients = await Client.find({}).sort({ nombre: 1 }).lean();

  const clientItems: ClientItem[] = clients.map((client) => ({
    id: client._id.toString(),
    nombre: client.nombre,
    razonSocial: client.razonSocial,
    cuit: client.cuit,
    telefono: client.telefono,
    email: client.email,
    direccion: client.direccion,
    localidad: client.localidad,
    provincia: client.provincia,
    contacto: client.contacto,
    condicionIva: client.condicionIva,
    notas: client.notas,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Cartera de clientes de la empresa.</p>
      </div>

      <ClientsClient clients={clientItems} />
    </div>
  );
}