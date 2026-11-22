import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Receta } from "@/models/Receta";
import { Componente } from "@/models/Componente";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Igual criterio que /imprimir/despachos/[id] y el resto: fuera de
// (dashboard), sin sidebar, encabezado de ITELSA (COMPANY) — nunca el
// encabezado "ITELSA SAS / Smart Lighting" que tenía la ficha del
// original (ver ModalReceta.tsx / FichaReceta.tsx de Gestión de
// Luminarias). Grilla de tarjetas por componente, igual idea que la
// ficha original, pero con el membrete propio de PayFlow.
export default async function ImprimirRecetaPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("recetas");
  await connectDB();

  const receta = await Receta.findById(params.id).lean();

  if (!receta) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Receta no encontrada.</p>
      </div>
    );
  }

  const componenteIds = receta.componentes.map((c) => c.componenteId);
  const componentes = await Componente.find({ _id: { $in: componenteIds } })
    .select("foto")
    .lean();
  const fotoPorId = new Map(componentes.map((c) => [c._id.toString(), c.foto]));

  const emittedAt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-5xl bg-white p-8 text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b-2 border-primary pb-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={COMPANY.logoUrl} alt={COMPANY.name} className="h-16 w-auto object-contain" />
          <div>
            <p className="text-xs text-gray-600">{COMPANY.address}</p>
            <p className="text-xs text-gray-600">Tel: {COMPANY.phone}</p>
            <p className="text-xs text-gray-600">CUIT: {COMPANY.cuit}</p>
            <p className="text-xs text-gray-600">{COMPANY.taxStatus}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">FICHA TÉCNICA DE ARMADO</p>
          <p className="text-sm text-gray-700">{receta.codigo}</p>
          <p className="text-xs text-gray-500">
            v{receta.version} — {new Date(receta.fechaVersion).toLocaleDateString("es-AR")}
          </p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-xl font-bold">{receta.nombre}</p>
        {receta.notas && <p className="mt-1 text-xs text-gray-600">{receta.notas}</p>}
      </section>

      <section className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Componentes necesarios — {receta.componentes.length}{" "}
          {receta.componentes.length === 1 ? "ítem" : "ítems"}
        </p>
        <div className="grid grid-cols-5 gap-3 print:break-inside-avoid">
          {receta.componentes.map((c) => {
            const foto = fotoPorId.get(c.componenteId.toString());
            return (
              <div
                key={c.componenteId.toString()}
                className="overflow-hidden rounded-md border border-gray-200 print:break-inside-avoid"
              >
                <div className="flex h-20 items-center justify-center bg-gray-100">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt={c.codigoComponente} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl">📦</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-[10px] font-bold text-primary">{c.codigoComponente}</p>
                  <p className="truncate text-xs text-gray-700">{c.descripcionComponente}</p>
                  <p className="mt-1 inline-block rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-extrabold">
                    x{c.cantidad}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {COMPANY.name} —{" "}
        {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
      </footer>
    </div>
  );
}
