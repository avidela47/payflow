import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { SimuladorViaje, type SimPaymentMode } from "@/models/SimuladorViaje";
import { formatCurrency } from "@/lib/utils";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

// Mismo criterio que /imprimir/viaticos/[id]: vista HTML normal (Ctrl+P /
// botón → diálogo del navegador, "Guardar como PDF" o impresora real) en
// vez del PDF armado a mano con jsPDF, que salía cortado.
const PAYMENT_MODE_LABELS: Record<SimPaymentMode, string> = {
  TARJETA: "Tarjeta",
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  TRANSFERENCIA: "Transferencia",
  ECHEQ: "E-Cheq",
};

function fmtFecha(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

export default async function ImprimirSimuladorViajePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("viaticos");
  await connectDB();

  const sim = await SimuladorViaje.findById(params.id).lean();

  if (!sim) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Simulación no encontrada.</p>
      </div>
    );
  }

  const emittedAt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const items = sim.items ?? [];
  const totalNeto = items.reduce((s, it) => s + (it.neto || 0), 0);
  const totalIva = items.reduce((s, it) => s + (it.iva || 0), 0);

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
          <p className="text-lg font-bold">SIMULADOR DE VIAJES</p>
          <p className="text-sm text-gray-700">{sim.nombre}</p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Proveedor</th>
              <th className="p-2">Forma de pago</th>
              <th className="p-2">Fecha de pago</th>
              <th className="p-2 text-right">Neto</th>
              <th className="p-2 text-right">IVA</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2">{it.proveedor}</td>
                <td className="p-2">{it.formaPago ? PAYMENT_MODE_LABELS[it.formaPago] : "—"}</td>
                <td className="p-2">{fmtFecha(it.fechaPago ? it.fechaPago.toISOString().slice(0, 10) : undefined)}</td>
                <td className="p-2 text-right">{formatCurrency(it.neto)}</td>
                <td className="p-2 text-right">{formatCurrency(it.iva)}</td>
                <td className="p-2 text-right font-medium">{formatCurrency(it.neto + it.iva)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  Sin ítems cargados.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-900 font-semibold text-white">
              <td className="p-2" colSpan={3}>
                TOTAL GENERAL
              </td>
              <td className="p-2 text-right">{formatCurrency(totalNeto)}</td>
              <td className="p-2 text-right">{formatCurrency(totalIva)}</td>
              <td className="p-2 text-right">{formatCurrency(totalNeto + totalIva)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {sim.notes && (
        <section className="mt-6 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">Notas</p>
          <p>{sim.notes}</p>
        </section>
      )}
    </div>
  );
}
