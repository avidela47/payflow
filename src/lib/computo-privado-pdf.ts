// PDF del cómputo valorizado — port de czPdf (líneas 4394-4461 del
// original). Mismo patrón que computos-pdf.ts: jsPDF por import dinámico,
// logo desde ITELSA_LOGO_DATA_URL (en vez del <img> del DOM que usaba el
// original, que acá no existe).
import { ITELSA_LOGO_DATA_URL } from "./itelsa-logo";
import { czNum, czFmt, czFmtN, czTotal, type ComputoValorizado } from "./computo-privado";

function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

function imgSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

type Col = { k: "n" | "d" | "c" | "p" | "s"; t: string; w: number; a: "left" | "right" };
const COLS: Col[] = [
  { k: "n", t: "#", w: 8, a: "left" },
  { k: "d", t: "ITEM / DETALLE", w: 92, a: "left" },
  { k: "c", t: "CANT.", w: 16, a: "right" },
  { k: "p", t: "P. UNITARIO", w: 31, a: "right" },
  { k: "s", t: "SUBTOTAL", w: 31, a: "right" },
];

export async function czPdf(z: ComputoValorizado): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const J = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 16;
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
        J.addImage(ITELSA_LOGO_DATA_URL, "PNG", M, 10, lw, lh);
      } catch {
        // sin logo si falla, no rompemos el PDF
      }
    }
    J.setFont("helvetica", "bold");
    J.setFontSize(9);
    J.setTextColor(...green);
    J.text("CÓMPUTO VALORIZADO", W - M, 14, { align: "right" });
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(...grey);
    J.text(J.splitTextToSize(z.proyecto || "", 90)[0], W - M, 19, { align: "right" });
    J.setDrawColor(209, 213, 219);
    J.setLineWidth(0.2);
    J.line(M, 25, W - M, 25);
    J.setDrawColor(...green);
    J.setLineWidth(0.6);
    J.line(M, 25, M + 14, 25);
  }

  function thead(y: number): number {
    J.setFillColor(...ink);
    J.rect(M, y, W - 2 * M, 8, "F");
    J.setFont("helvetica", "bold");
    J.setFontSize(7.5);
    J.setTextColor(255, 255, 255);
    let x = M;
    COLS.forEach((c) => {
      J.text(c.t, c.a === "right" ? x + c.w - 2 : x + 2, y + 5.3, { align: c.a });
      x += c.w;
    });
    return y + 8;
  }

  header();
  let y = 36;
  J.setFont("helvetica", "bold");
  J.setFontSize(8);
  J.setTextColor(...green);
  J.text("CÓMPUTO VALORIZADO", M, y);
  J.setFontSize(17);
  J.setTextColor(...ink);
  const tl = J.splitTextToSize(z.proyecto || "", W - 2 * M);
  J.text(tl, M, y + 8);
  y += 8 + tl.length * 7;
  J.setFont("helvetica", "normal");
  J.setFontSize(9);
  J.setTextColor(...grey);
  J.text(`Fecha: ${fmtFecha(z.fecha)}     Moneda: ${z.moneda === "ARS" ? "Pesos argentinos ($)" : "Dolares estadounidenses (US$)"}`, M, y + 2);
  y += 9;
  y = thead(y);

  const items = (z.items || []).filter((it) => (it.desc || "").trim() || (it.det || "").trim() || czNum(it.pu));
  items.forEach((it, i) => {
    J.setFont("helvetica", "bold");
    J.setFontSize(8.5);
    const dl = J.splitTextToSize(it.desc || "-", COLS[1].w - 4);
    J.setFont("helvetica", "normal");
    J.setFontSize(7.5);
    const tl2 = it.det ? J.splitTextToSize(it.det, COLS[1].w - 4) : [];
    const rh = Math.max(8, 3.5 + dl.length * 3.8 + tl2.length * 3.3 + 2.5);
    if (y + rh > H - 40) {
      J.addPage();
      header();
      y = thead(32);
    }
    if (i % 2) {
      J.setFillColor(248, 250, 251);
      J.rect(M, y, W - 2 * M, rh, "F");
    }
    let x = M;
    const ty = y + 5;
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(...grey);
    J.text(String(i + 1), x + 2, ty);
    x += COLS[0].w;
    J.setFont("helvetica", "bold");
    J.setTextColor(...ink);
    J.text(dl, x + 2, ty);
    if (tl2.length) {
      J.setFont("helvetica", "normal");
      J.setFontSize(7.5);
      J.setTextColor(...grey);
      J.text(tl2, x + 2, ty + dl.length * 3.8);
    }
    x += COLS[1].w;
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(...ink);
    J.text(String(it.cant || ""), x + COLS[2].w - 2, ty, { align: "right" });
    x += COLS[2].w;
    const pu = czNum(it.pu);
    const sub = czNum(it.cant) * pu;
    J.text(pu ? czFmtN(pu) : "-", x + COLS[3].w - 2, ty, { align: "right" });
    x += COLS[3].w;
    J.setFont("helvetica", "bold");
    J.text(pu ? czFmtN(sub) : "-", x + COLS[4].w - 2, ty, { align: "right" });
    J.setDrawColor(229, 231, 235);
    J.setLineWidth(0.15);
    J.line(M, y + rh, W - M, y + rh);
    y += rh;
  });

  if (y + 14 > H - 30) {
    J.addPage();
    header();
    y = 32;
  }
  y += 2;
  J.setFillColor(240, 247, 246);
  J.rect(M, y, W - 2 * M, 11, "F");
  J.setFillColor(...green);
  J.rect(M, y, 1, 11, "F");
  J.setFont("helvetica", "bold");
  J.setFontSize(9.5);
  J.setTextColor(...ink);
  J.text("TOTAL", M + 5, y + 7.2);
  J.setFontSize(12);
  J.setTextColor(...green);
  J.text(czFmt(czTotal(z), z.moneda), W - M - 2, y + 7.5, { align: "right" });
  y += 18;

  if ((z.notas || "").trim()) {
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    const nl = J.splitTextToSize(z.notas!.trim(), W - 2 * M - 8);
    if (y + 10 + nl.length * 4 > H - 22) {
      J.addPage();
      header();
      y = 32;
    }
    J.setFont("helvetica", "bold");
    J.setFontSize(7.5);
    J.setTextColor(...green);
    J.text("NOTAS Y CONDICIONES", M, y);
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(55, 65, 81);
    J.text(nl, M, y + 5.5);
  }

  const np = J.getNumberOfPages();
  for (let p = 1; p <= np; p++) {
    J.setPage(p);
    J.setFont("helvetica", "normal");
    J.setFontSize(7.5);
    J.setTextColor(...grey);
    J.text(`ITELSA S.A.S. - Cómputo valorizado - ${fmtFecha(z.fecha)}`, M, H - 10);
    J.text(`Página ${p} de ${np}`, W - M, H - 10, { align: "right" });
  }

  const safe = (z.proyecto || "").replace(/[^\w-]+/g, "_");
  J.save(`Computo_valorizado_${safe}_${z.fecha || ""}.pdf`);
}
