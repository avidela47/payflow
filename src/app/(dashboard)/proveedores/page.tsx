import { connectDB } from "@/lib/db";
import { Provider } from "@/models/Provider";
import { ProvidersClient, type ProviderItem } from "./proveedores-client";

export default async function ProveedoresPage() {
  await connectDB();

  const providers = await Provider.find({}).sort({ nombre: 1 }).lean();

  const providerItems: ProviderItem[] = providers.map((provider) => ({
    id: provider._id.toString(),
    codigo: provider.codigo,
    nombre: provider.nombre,
    razonSocial: provider.razonSocial,
    cuit: provider.cuit,
    telefono: provider.telefono,
    email: provider.email,
    direccion: provider.direccion,
    localidad: provider.localidad,
    provincia: provider.provincia,
    contacto: provider.contacto,
    condicionIva: provider.condicionIva,
    notas: provider.notas,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <p className="text-sm text-muted-foreground">Cartera de proveedores de la empresa.</p>
      </div>

      <ProvidersClient providers={providerItems} />
    </div>
  );
}