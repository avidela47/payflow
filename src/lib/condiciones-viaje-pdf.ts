// PDF corto de "Condiciones de viaje" (Finanzas > Viajes). Mismo patrón
// visual que computo-privado-pdf.ts (logo ITELSA, jsPDF por import
// dinámico) pero mucho más simple: una ficha de campo-valor, no una tabla
// de ítems — 2026-11-25, Ariel pidió la opción de imprimir esto.
import { ITELSA_LOGO_DATA_URL } from "./itelsa-logo";
import { formatCurrency } from "./utils";
import type { ViaticoCondicionesPaymentMode } from "@/models/Viatico";

export type CondicionesViajePdfData = {
  nombreViaje: string;
  fechaInicioISO: string;
  fechaFinISO: string;
  empleadosNombres: string[];
  viaticosPactados?: string;
  llevanInsumos?: boolean;
  tieneVale?: boolean;
  numeroVale?: string;
  formaPago?: ViaticoCondicionesPaymentMode;
  montoEfectivo?: number;
};

function fmtFecha(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function imgSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

export async function condicionesViajePdf(data: CondicionesViajePdfData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const J = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 20;
  const ink: [number, number, number] = [13, 27, 42];
  const green: [number, number, number] = [0, 105, 92];
  const grey: [number, number, number] = [107, 114, 128];
  const logoSz = await imgSize(ITELSA_LOGO_DATA_URL);

  if (logoSz) {
    let lh = 12;
    let lw = (lh * logoSz.w) / logoSz.h;
    if (lw > 40) {
      lw = 40;
      lh = (lw * logoSz.h) / logoSz.w;
    }
    try {
      J.addImage(ITELSA_LOGO_DATA_URL, "PNG", M, 14, lw, lh);
    } catch {
      // sin logo si falla, no rompemos el PDF
    }
  }
  J.setFont("helvetica", "bold");
  J.setFontSize(9);
  J.setTextColor(...green);
  J.text("CONDICIONES DE VIAJE", W - M, 18, { align: "right" });
  J.setDrawColor(209, 213, 219);
  J.setLineWidth(0.2);
  J.line(M, 30, W - M, 30);
  J.setDrawColor(...green);
  J.setLineWidth(0.6);
  J.line(M, 30, M + 14, 30);

  let y = 42;
  J.setFont("helvetica", "bold");
  J.setFontSize(17);
  J.setTextColor(...ink);
  J.text(data.nombreViaje, M, y);
  y += 7;
  J.setFont("helvetica", "normal");
  J.setFontSize(9.5);
  J.setTextColor(...grey);
  const rango =
    data.fechaInicioISO === data.fechaFinISO
      ? fmtFecha(data.fechaInicioISO)
      : `${fmtFecha(data.fechaInicioISO)} – ${fmtFecha(data.fechaFinISO)}`;
  J.text(rango, M, y);
  y += 12;

  function campo(label: string, value: string) {
    J.setFont("helvetica", "bold");
    J.setFontSize(9);
    J.setTextColor(...green);
    J.text(label.toUpperCase(), M, y);
    y += 5.5;
    J.setFont("helvetica", "normal");
    J.setFontSize(10.5);
    J.setTextColor(...ink);
    const lines = J.splitTextToSize(value, W - 2 * M);
    J.text(lines, M, y);
    y += lines.length * 5.5 + 6;
  }

  campo("Empleados que viajan", data.empleadosNombres.length > 0 ? data.empleadosNombres.join(", ") : "—");
  if (data.viaticosPactados) campo("Viáticos pactados", data.viaticosPactados);
  campo("Llevan insumos", data.llevanInsumos ? "Sí" : "No");
  campo("Tiene vale", data.tieneVale ? `Sí${data.numeroVale ? ` — N° ${data.numeroVale}` : ""}` : "No");
  if (data.formaPago) {
    const label = data.formaPago === "TARJETA" ? "Tarjeta de crédito" : "Efectivo";
    const valor =
      data.formaPago === "EFECTIVO" && data.montoEfectivo
        ? `${label} — ${formatCurrency(data.montoEfectivo)}`
        : label;
    campo("Forma de pago viáticos", valor);
  }

  J.setFont("helvetica", "normal");
  J.setFontSize(7.5);
  J.setTextColor(...grey);
  J.text(`ITELSA S.A.S. - Condiciones de viaje - ${fmtFecha(new Date().toISOString().slice(0, 10))}`, M, 287);

  const safe = data.nombreViaje.replace(/[^\w-]+/g, "_");
  J.save(`Condiciones_viaje_${safe}.pdf`);
}
