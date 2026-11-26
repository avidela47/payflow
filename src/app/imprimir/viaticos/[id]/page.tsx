import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Viatico } from "@/models/Viatico";
import { formatCurrency } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Mismo criterio que /imprimir/presupuestos/[id] y el resto de /imprimir/*:
// fuera de (dashboard), sin sidebar, Ctrl+P / botón → el diálogo de
// impresión del navegador ("Guardar como PDF" o mandar a una impresora
// real). 2026-11-26, Ariel: el PDF armado a mano con jsPDF salía con el
// contenido cortado y sin vista previa — esto lo reemplaza por una vista
// HTML normal, que el navegador pagina solo sin recortar nada.
function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

function fmtMonto(neto: number, iva: number): string {
  if (!iva) return formatCurrency(neto);
  return `${formatCurrency(neto)} + IVA ${formatCurrency(iva)}`;
}

type Fila = { concepto: string; neto: number; iva: number };

export default async function ImprimirViaticoPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("viaticos");
  await connectDB();

  const v = await Viatico.findById(params.id)
    .populate(["empleados.employee", "topesDiarios.employee"])
    .lean();

  if (!v) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Viaje no encontrado.</p>
      </div>
    );
  }

  const emittedAt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const fechaInicioISO = v.fechaInicio.toISOString().slice(0, 10);
  const fechaFinISO = v.fechaFin.toISOString().slice(0, 10);

  const filas: Fila[] = [];
  for (const e of v.empleados ?? []) {
    const employeeDoc =
      e.employee && typeof e.employee === "object" && "nombre" in e.employee
        ? (e.employee as unknown as { nombre: string; apellido: string })
        : null;
    const nombre = employeeDoc ? `${employeeDoc.nombre} ${employeeDoc.apellido}` : "Empleado eliminado";
    const factor = e.honorarioType === "DIA" ? e.dias ?? 1 : 1;
    filas.push({
      concepto: `Honorario — ${nombre}${e.honorarioType === "DIA" ? ` (${e.dias ?? 1} día(s))` : ""}`,
      neto: e.monto * factor,
      iva: (e.iva ?? 0) * factor,
    });
  }
  if (v.hospedaje?.costoPorDia) {
    const dias = v.hospedaje.cantidadDias ?? 0;
    filas.push({ concepto: "Hospedaje", neto: v.hospedaje.costoPorDia * dias, iva: (v.hospedaje.ivaPorDia ?? 0) * dias });
  }
  if (v.combustible?.monto) {
    filas.push({ concepto: "Combustible (EdenRed)", neto: v.combustible.monto, iva: v.combustible.iva ?? 0 });
  }
  for (const x of v.extras ?? []) {
    filas.push({ concepto: `Extra — ${x.descripcion}`, neto: x.monto, iva: x.iva ?? 0 });
  }
  for (const m of v.materiales ?? []) {
    filas.push({ concepto: `Material — ${m.descripcion}${m.cantidad ? ` x${m.cantidad}` : ""}`, neto: m.monto, iva: m.iva ?? 0 });
  }
  if (v.seguro?.costo) {
    filas.push({ concepto: "Seguro", neto: v.seguro.costo, iva: v.seguro.iva ?? 0 });
  }

  const totalNeto = filas.reduce((s, f) => s + f.neto, 0);
  const totalIva = filas.reduce((s, f) => s + f.iva, 0);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black print:p-0">
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
          <p className="text-lg font-bold">GASTOS DE VIAJE</p>
          <p className="text-sm text-gray-700">{v.nombre}</p>
          <p className="text-xs text-gray-500">
            {fechaInicioISO === fechaFinISO ? fmtFecha(fechaInicioISO) : `${fmtFecha(fechaInicioISO)} – ${fmtFecha(fechaFinISO)}`}
          </p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Concepto</th>
              <th className="p-2 text-right">Neto</th>
              <th className="p-2 text-right">IVA</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2">{f.concepto}</td>
                <td className="p-2 text-right">{formatCurrency(f.neto)}</td>
                <td className="p-2 text-right">{formatCurrency(f.iva)}</td>
                <td className="p-2 text-right font-medium">{formatCurrency(f.neto + f.iva)}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  Sin gastos cargados.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 font-semibold text-white">
              <td className="p-2">TOTAL GENERAL</td>
              <td className="p-2 text-right">{formatCurrency(totalNeto)}</td>
              <td className="p-2 text-right">{formatCurrency(totalIva)}</td>
              <td className="p-2 text-right">{formatCurrency(totalNeto + totalIva)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {(v.topesDiarios ?? []).length > 0 && (
        <section className="mt-8">
          <p className="mb-2 text-sm font-semibold">
            Tope diario de viático <span className="font-normal text-gray-500">(informativo — no se suma al total)</span>
          </p>
          <div className="flex flex-col gap-2">
            {(v.topesDiarios ?? []).map((t, i) => {
              const employeeDoc =
                t.employee && typeof t.employee === "object" && "nombre" in t.employee
                  ? (t.employee as unknown as { nombre: string; apellido: string })
                  : null;
              const nombre = employeeDoc ? `${employeeDoc.nombre} ${employeeDoc.apellido}` : "Empleado eliminado";
              return (
                <div key={i} className="break-inside-avoid rounded bg-amber-50 p-2 text-xs">
                  <p className="font-semibold text-gray-700">
                    {nombre} — importe {fmtMonto(t.monto, t.iva ?? 0)}/día
                  </p>
                  {(t.gastos ?? []).length > 0 && (
                    <ul className="ml-4 list-disc">
                      {(t.gastos ?? []).map((g, gi) => (
                        <li key={gi}>
                          {g.descripcion} — {fmtMonto(g.monto, g.iva ?? 0)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {v.notes && (
        <section className="mt-6 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">Notas</p>
          <p>{v.notes}</p>
        </section>
      )}
    </div>
  );
}
