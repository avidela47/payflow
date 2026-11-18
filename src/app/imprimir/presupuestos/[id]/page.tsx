import { redirect } from "next/navigation";
import { getSession, requireModuleAccess } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Presupuesto } from "@/models/Presupuesto";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "@/components/print-button";

function formatMoneda(value: number, moneda: string): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${moneda} ${formatted}`;
}

// Igual criterio que /imprimir/reportes/*: fuera de (dashboard), sin
// sidebar, encabezado con los datos de ITELSA (COMPANY) — no el
// encabezado de Gestión de Luminarias. Pensada para Ctrl+P → Guardar
// como PDF o enviar al cliente.
export default async function ImprimirPresupuestoPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  await requireModuleAccess("presupuestos");
  await connectDB();

  const presupuesto = await Presupuesto.findById(params.id).lean();

  if (!presupuesto) {
    return (
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        <p>Presupuesto no encontrado.</p>
      </div>
    );
  }

  const emittedAt = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

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
          <p className="text-lg font-bold">PRESUPUESTO</p>
          <p className="text-sm text-gray-700">N° {presupuesto.numero}</p>
          <p className="text-xs text-gray-500">
            {new Date(presupuesto.fecha).toLocaleDateString("es-AR")} — válido{" "}
            {presupuesto.validezDias} días
          </p>
          <p className="text-xs text-gray-500">Emitido: {emittedAt}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">{presupuesto.razonSocial}</p>
          {presupuesto.cuit && <p className="text-gray-600">CUIT {presupuesto.cuit}</p>}
          {presupuesto.direccion && (
            <p className="text-gray-600">
              {presupuesto.direccion}
              {presupuesto.localidad ? `, ${presupuesto.localidad}` : ""}
            </p>
          )}
          {presupuesto.telefono && <p className="text-gray-600">Tel: {presupuesto.telefono}</p>}
          {presupuesto.email && <p className="text-gray-600">{presupuesto.email}</p>}
          {presupuesto.condicionIva && <p className="text-gray-600">{presupuesto.condicionIva}</p>}
        </div>
        <div className="text-right text-gray-600">
          {presupuesto.vendedor && <p>Vendedor: {presupuesto.vendedor}</p>}
          {presupuesto.atencion && <p>Atención: {presupuesto.atencion}</p>}
          {presupuesto.cotizacion && <p>Cotización: {presupuesto.cotizacion}</p>}
        </div>
      </section>

      <section className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-left text-white">
              <th className="p-2">Código</th>
              <th className="p-2">Descripción</th>
              <th className="p-2 text-right">Cant.</th>
              <th className="p-2 text-right">Bonif.</th>
              <th className="p-2 text-right">P. Unit.</th>
              <th className="p-2 text-right">P. Total</th>
            </tr>
          </thead>
          <tbody>
            {presupuesto.lineas.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2">{l.codigo || "—"}</td>
                <td className="p-2">{l.descripcion}</td>
                <td className="p-2 text-right">{l.cantidad}</td>
                <td className="p-2 text-right">{l.bonificacion ? `${l.bonificacion}%` : "—"}</td>
                <td className="p-2 text-right">{formatMoneda(l.precioUnitario, presupuesto.moneda)}</td>
                <td className="p-2 text-right">{formatMoneda(l.precioTotal, presupuesto.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-4 flex justify-end">
        <table className="w-64 text-sm">
          <tbody>
            <tr>
              <td className="p-1 text-gray-600">Subtotal</td>
              <td className="p-1 text-right">{formatMoneda(presupuesto.subtotal, presupuesto.moneda)}</td>
            </tr>
            <tr>
              <td className="p-1 text-gray-600">IVA</td>
              <td className="p-1 text-right">{formatMoneda(presupuesto.iva, presupuesto.moneda)}</td>
            </tr>
            <tr className="border-t border-gray-300 font-bold">
              <td className="p-1">Total</td>
              <td className="p-1 text-right">{formatMoneda(presupuesto.total, presupuesto.moneda)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-6 text-xs text-gray-600">
        {presupuesto.formaPago && <p>Forma de pago: {presupuesto.formaPago}</p>}
        {presupuesto.plazoEntrega && <p>Plazo de entrega: {presupuesto.plazoEntrega}</p>}
        {presupuesto.comentario && <p className="mt-2">{presupuesto.comentario}</p>}
      </section>
    </div>
  );
}