// PDF de gastos de un viaje (Finanzas > Viajes), con neto e IVA
// discriminados por concepto — 2026-11-26, pedido de Ariel junto con el
// resto del cambio de IVA en Viajes. Mismo patrón visual que
// condiciones-viaje-pdf.ts (logo ITELSA, jsPDF por import dinámico) pero
// con una tabla de conceptos en vez de una ficha de campo-valor — tabla
// dibujada a mano (texto + líneas), igual criterio que computos-pdf.ts:
// no se usa ningún plugin de autotable en este proyecto.
import { ITELSA_LOGO_DATA_URL } from "./itelsa-logo";
import { formatCurrency } from "./utils";

export type ViajeGastosPdfRow = { label: string; neto: number; iva: number };

export type ViajeGastosPdfData = {
  nombreViaje: string;
  fechaInicioISO: string;
  fechaFinISO: string;
  empleados: ViajeGastosPdfRow[];
  hospedaje?: { neto: number; iva: number };
  combustible?: { neto: number; iva: number };
  extras: ViajeGastosPdfRow[];
  materiales: ViajeGastosPdfRow[];
  seguro?: { neto: number; iva: number };
  // Informativo: NO se suma al total general (es un tope/control, no un
  // gasto nuevo) — se imprime como sección aparte, igual que en pantalla.
  topesDiarios: ViajeGastosPdfRow[];
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

export async function viajeGastosPdf(data: ViajeGastosPdfData): Promise<void> {
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
    J.text("GASTOS DE VIAJE", W - M, 18, { align: "right" });
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
  y += 10;

  const colLabelW = W - 2 * M - 90;
  const colX = { label: M, neto: M + colLabelW + 2, iva: M + colLabelW + 32, total: M + colLabelW + 62 };

  function tablaHeader() {
    J.setFillColor(...ink);
    J.rect(M, y, W - 2 * M, 7, "F");
    J.setFont("helvetica", "bold");
    J.setFontSize(7.5);
    J.setTextColor(255, 255, 255);
    J.text("CONCEPTO", colX.label + 2, y + 4.8);
    J.text("NETO", colX.neto + 26, y + 4.8, { align: "right" });
    J.text("IVA", colX.iva + 26, y + 4.8, { align: "right" });
    J.text("TOTAL", colX.total + 26, y + 4.8, { align: "right" });
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

  function fila(label: string, neto: number, iva: number, idx: number) {
    checkPageBreak();
    if (idx % 2 === 1) {
      J.setFillColor(244, 247, 248);
      J.rect(M, y, W - 2 * M, 7, "F");
    }
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(...ink);
    J.text(J.splitTextToSize(label, colLabelW - 2)[0], colX.label + 2, y + 4.8);
    J.setTextColor(55, 65, 81);
    J.text(formatCurrency(neto), colX.neto + 26, y + 4.8, { align: "right" });
    J.text(formatCurrency(iva), colX.iva + 26, y + 4.8, { align: "right" });
    J.setFont("helvetica", "bold");
    J.setTextColor(...green);
    J.text(formatCurrency(neto + iva), colX.total + 26, y + 4.8, { align: "right" });
    y += 7;
  }

  type Row = { label: string; neto: number; iva: number };
  const rows: Row[] = [];
  data.empleados.forEach((e) => rows.push({ label: `Honorario — ${e.label}`, neto: e.neto, iva: e.iva }));
  if (data.hospedaje) rows.push({ label: "Hospedaje", neto: data.hospedaje.neto, iva: data.hospedaje.iva });
  if (data.combustible)
    rows.push({ label: "Combustible (EdenRed)", neto: data.combustible.neto, iva: data.combustible.iva });
  data.extras.forEach((e) => rows.push({ label: `Extra — ${e.label}`, neto: e.neto, iva: e.iva }));
  data.materiales.forEach((m) => rows.push({ label: `Material — ${m.label}`, neto: m.neto, iva: m.iva }));
  if (data.seguro) rows.push({ label: "Seguro", neto: data.seguro.neto, iva: data.seguro.iva });

  tablaHeader();
  if (rows.length === 0) {
    J.setFont("helvetica", "italic");
    J.setFontSize(8.5);
    J.setTextColor(...grey);
    J.text("Sin gastos cargados.", colX.label + 2, y + 4.8);
    y += 9;
  } else {
    rows.forEach((r, i) => fila(r.label, r.neto, r.iva, i));
  }

  const totalNeto = rows.reduce((s, r) => s + r.neto, 0);
  const totalIva = rows.reduce((s, r) => s + r.iva, 0);

  checkPageBreak(10);
  J.setFillColor(...ink);
  J.rect(M, y, W - 2 * M, 8.5, "F");
  J.setFont("helvetica", "bold");
  J.setFontSize(8.5);
  J.setTextColor(255, 255, 255);
  J.text("TOTAL GENERAL", colX.label + 2, y + 5.8);
  J.text(formatCurrency(totalNeto), colX.neto + 26, y + 5.8, { align: "right" });
  J.text(formatCurrency(totalIva), colX.iva + 26, y + 5.8, { align: "right" });
  J.text(formatCurrency(totalNeto + totalIva), colX.total + 26, y + 5.8, { align: "right" });
  y += 14;

  if (data.topesDiarios.length > 0) {
    checkPageBreak(10);
    J.setFont("helvetica", "bold");
    J.setFontSize(8.5);
    J.setTextColor(...green);
    J.text("TOPE DIARIO DE VIÁTICO (informativo — no se suma al total)", M, y);
    y += 6;
    data.topesDiarios.forEach((t, i) => fila(t.label, t.neto, t.iva, i));
  }

  const n = J.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    J.setPage(p);
    J.setFont("helvetica", "normal");
    J.setFontSize(7.5);
    J.setTextColor(...grey);
    J.text(`ITELSA S.A.S. - Gastos de viaje - ${fmtFecha(new Date().toISOString().slice(0, 10))}`, M, H - 10);
    J.text(`Página ${p} de ${n}`, W - M, H - 10, { align: "right" });
  }

  const safe = data.nombreViaje.replace(/[^\w-]+/g, "_");
  J.save(`Gastos_viaje_${safe}.pdf`);
}
