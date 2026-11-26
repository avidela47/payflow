import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Licitacion } from "@/models/Licitacion";
import { LicitacionesClient, type LicitacionItem } from "./licitaciones-client";

export default async function LicitacionesPage() {
  const session = await requireModuleAccess("licitaciones");

  await connectDB();
  const entidades = await Licitacion.find({}).sort({ entidad: 1 }).lean();

  const items: LicitacionItem[] = entidades.map((e) => ({
    id: e._id.toString(),
    entidad: e.entidad,
    estado: e.estado,
    numeroProveedor: e.numeroProveedor,
    licitaciones: (e.licitaciones ?? []).map((it) => ({
      numero: it.numero,
      estado: it.estado,
      documento: it.documento
        ? {
            nombre: it.documento.nombre,
            path: it.documento.path,
            mimeType: it.documento.mimeType,
            size: it.documento.size,
            uploadedAtISO: it.documento.uploadedAt.toISOString(),
          }
        : undefined,
    })),
    otrosDocumentos: (e.otrosDocumentos ?? []).map((d) => ({
      nombre: d.nombre,
      path: d.path,
      mimeType: d.mimeType,
      size: d.size,
      uploadedAtISO: d.uploadedAt.toISOString(),
    })),
    observaciones: e.observaciones,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Licitaciones</h1>
        <p className="text-sm text-muted-foreground">
          Registro de inscripción como proveedor ante cada organismo/entidad, con sus licitaciones
          puntuales — resumen semanal por mail de todo este registro.
        </p>
      </div>

      <LicitacionesClient items={items} role={session?.user?.role ?? ""} />
    </div>
  );
}
