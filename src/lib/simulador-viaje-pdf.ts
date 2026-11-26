// PDF del Simulador de viajes (Finanzas > Viajes), con neto e IVA
// discriminados por ítem — 2026-11-26, pedido de Ariel. Mismo patrón que
// viaje-gastos-pdf.ts (tabla dibujada a mano, sin plugin de autotable).
import { ITELSA_LOGO_DATA_URL } from "./itelsa-logo";
import { formatCurrency } from "./utils";
import type { SimPaymentMode } from "@/models/SimuladorViaje";

const PAYMENT_MODE_LABELS: Record<SimPaymentMode, string> = {
  TARJETA: "Tarjeta",
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  TRANSFERENCIA: "Transferencia",
  ECHEQ: "E-Cheq",
};

export type SimuladorViajePdfItem = {
  proveedor: string;
  neto: number;
  iva: number;
  formaPago?: SimPaymentMode;
  fechaPagoISO?: string;
};

export type SimuladorViajePdfData = {
  nombre: string;
  items: SimuladorViajePdfItem[];
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

export async function simuladorViajePdf(data: SimuladorViajePdfData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const J = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 20;
  const ink: [number, number, number] = [13, 27, 42];
  const green: [number, number, number] = [0, 105, 92];
  const grey: [number, number, number] = [107, 114, 128];
  const logoSz = await imgSize(ITELSA_LOGO_DATA_URL);

  function header() {
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
    J.text("SIMULADOR DE VIAJES", W - M, 18, { align: "right" });
    J.setDrawColor(209, 213, 219);
    J.setLineWidth(0.2);
    J.line(M, 30, W - M, 30);
    J.setDrawColor(...green);
    J.setLineWidth(0.6);
    J.line(M, 30, M + 14, 30);
  }

  header();
  let y = 42;
  J.setFont("helvetica", "bold");
  J.setFontSize(17);
  J.setTextColor(...ink);
  J.text(data.nombre, M, y);
  y += 10;

  const colLabelW = W - 2 * M - 110;
  const colX = {
    label: M,
    forma: M + colLabelW + 2,
    neto: M + colLabelW + 32,
    iva: M + colLabelW + 60,
    total: M + colLabelW + 88,
  };

  function tablaHeader() {
    J.setFillColor(...ink);
    J.rect(M, y, W - 2 * M, 7, "F");
    J.setFont("helvetica", "bold");
    J.setFontSize(7.5);
    J.setTextColor(255, 255, 255);
    J.text("PROVEEDOR", colX.label + 2, y + 4.8);
    J.text("FORMA DE PAGO", colX.forma + 2, y + 4.8);
    J.text("NETO", colX.neto + 24, y + 4.8, { align: "right" });
    J.text("IVA", colX.iva + 24, y + 4.8, { align: "right" });
    J.text("TOTAL", colX.total + 24, y + 4.8, { align: "right" });
    y += 7;
  }

  function checkPageBreak(extra = 7) {
    if (y + extra > H - 24) {
      J.addPage();
      header();
      y = 36;
      tablaHeader();
    }
  }

  tablaHeader();
  if (data.items.length === 0) {
    J.setFont("helvetica", "italic");
    J.setFontSize(8.5);
    J.setTextColor(...grey);
    J.text("Sin ítems cargados.", colX.label + 2, y + 4.8);
    y += 9;
  }
  data.items.forEach((it, i) => {
    checkPageBreak();
    if (i % 2 === 1) {
      J.setFillColor(244, 247, 248);
      J.rect(M, y, W - 2 * M, 7, "F");
    }
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(...ink);
    J.text(J.splitTextToSize(it.proveedor, colLabelW - 2)[0], colX.label + 2, y + 4.8);
    J.setTextColor(...grey);
    const formaLabel = it.formaPago ? PAYMENT_MODE_LABELS[it.formaPago] : "—";
    const formaTxt = it.fechaPagoISO ? `${formaLabel} · ${fmtFecha(it.fechaPagoISO)}` : formaLabel;
    J.text(formaTxt, colX.forma + 2, y + 4.8);
    J.setTextColor(55, 65, 81);
    J.text(formatCurrency(it.neto), colX.neto + 24, y + 4.8, { align: "right" });
    J.text(formatCurrency(it.iva), colX.iva + 24, y + 4.8, { align: "right" });
    J.setFont("helvetica", "bold");
    J.setTextColor(...green);
    J.text(formatCurrency(it.neto + it.iva), colX.total + 24, y + 4.8, { align: "right" });
    y += 7;
  });

  const totalNeto = data.items.reduce((s, it) => s + it.neto, 0);
  const totalIva = data.items.reduce((s, it) => s + it.iva, 0);

  checkPageBreak(10);
  J.setFillColor(...ink);
  J.rect(M, y, W - 2 * M, 8.5, "F");
  J.setFont("helvetica", "bold");
  J.setFontSize(8.5);
  J.setTextColor(255, 255, 255);
  J.text("TOTAL GENERAL", colX.label + 2, y + 5.8);
  J.text(formatCurrency(totalNeto), colX.neto + 24, y + 5.8, { align: "right" });
  J.text(formatCurrency(totalIva), colX.iva + 24, y + 5.8, { align: "right" });
  J.text(formatCurrency(totalNeto + totalIva), colX.total + 24, y + 5.8, { align: "right" });
  y += 14;

  const n = J.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    J.setPage(p);
    J.setFont("helvetica", "normal");
    J.setFontSize(7.5);
    J.setTextColor(...grey);
    J.text(`ITELSA S.A.S. - Simulador de viajes - ${fmtFecha(new Date().toISOString().slice(0, 10))}`, M, H - 10);
    J.text(`Página ${p} de ${n}`, W - M, H - 10, { align: "right" });
  }

  const safe = data.nombre.replace(/[^\w-]+/g, "_");
  J.save(`Simulacion_viaje_${safe}.pdf`);
}
