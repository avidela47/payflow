// PDF de cierre del cómputo. Portado de cgPdf en
// /tmp/protectos-itelsa/index.html (líneas ~2524-2680): mismo layout A4,
// mismas columnas y anchos, mismo formato de informe ITELSA (jsPDF puro, sin
// plugin de tablas, igual que el original). jspdf se importa dinámicamente
// (como xlsx en pipeline-client.tsx) para no sumar peso al bundle inicial.
//
// Fase 3 agrega acá la hoja de plano (A4 horizontal) con los marcadores de
// ubicación, cuando el cómputo tiene `plano`/`marcas` cargados — leyendo el
// JPEG real desde la colección "gfiles" (ver plano-editor.tsx).
import { doc, getDoc } from "firebase/firestore";
import { dbProyectos } from "./firebase-proyectos";
import { ITELSA_LOGO_DATA_URL } from "./itelsa-logo";
import { teamMemberById } from "./proyectos-team";
import { colorDeItem, hexToRgb } from "./computos-colors";
import type { ComputoDoc, Luminaria } from "@/app/(dashboard)/computos/computos-client";

async function cargarPlanoData(fileId: string): Promise<string | null> {
  const snap = await getDoc(doc(dbProyectos, "gfiles", fileId));
  if (!snap.exists()) return null;
  return (snap.data() as { data: string }).data;
}

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

type Col = { t: string; w: number; a: "center" | "left"; k?: string };

const COLS: Col[] = [
  { t: "#", w: 7, a: "center" },
  { t: "IMAGEN", w: 19, a: "center" },
  { t: "CÓDIGO / LUMINARIA", w: 44, a: "left" },
  { t: "POTENCIA", w: 16, a: "left", k: "potencia" },
  { t: "ÁNGULO", w: 15, a: "left", k: "angulo" },
  { t: "TEMP. COLOR", w: 19, a: "left", k: "temperatura" },
  { t: "PROTOCOLO", w: 19, a: "left", k: "protocolo" },
  { t: "TENSIÓN", w: 21, a: "left", k: "tension" },
  { t: "CANT.", w: 14, a: "center" },
];

export async function generarPdfComputo(c: ComputoDoc, luminarias: Luminaria[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const J = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 18;
  const ink: [number, number, number] = [13, 27, 42];
  const green: [number, number, number] = [0, 105, 92];
  const grey: [number, number, number] = [107, 114, 128];
  const fecha = fmtFecha(c.cerrado || new Date().toISOString().slice(0, 10));
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
        // si la imagen no carga, seguimos sin logo en vez de romper el PDF
      }
    }
    J.setFont("helvetica", "bold");
    J.setFontSize(9);
    J.setTextColor(...green);
    J.text("CÓMPUTO DE LUMINARIAS", W - M, 14, { align: "right" });
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(...grey);
    J.text(J.splitTextToSize(c.proyecto, 90)[0], W - M, 19, { align: "right" });
    J.setDrawColor(209, 213, 219);
    J.setLineWidth(0.2);
    J.line(M, 25, W - M, 25);
    J.setDrawColor(...green);
    J.setLineWidth(0.6);
    J.line(M, 25, M + 14, 25);
  }

  function tablaHeader(y: number): number {
    J.setFillColor(...ink);
    J.rect(M, y, W - 2 * M, 8, "F");
    J.setFont("helvetica", "bold");
    J.setFontSize(6.6);
    J.setTextColor(255, 255, 255);
    let x = M;
    COLS.forEach((col) => {
      J.text(col.t, col.a === "center" ? x + col.w / 2 : x + 2, y + 5.2, { align: col.a === "center" ? "center" : "left" });
      x += col.w;
    });
    return y + 8;
  }

  header();
  let y = 36;
  J.setFont("helvetica", "bold");
  J.setFontSize(8);
  J.setTextColor(...green);
  J.text("CÓMPUTO DE LUMINARIAS", M, y);
  y += 7;
  J.setFontSize(16);
  J.setTextColor(...ink);
  const tl = J.splitTextToSize(c.proyecto, W - 2 * M);
  J.text(tl, M, y);
  y += tl.length * 6.5 + 2;

  const totalLum = c.items.reduce((s, it) => s + (parseInt(String(it.cant), 10) || 0), 0);
  const meta: [string, string][] = [
    ["Fecha", fecha],
    ["Realizado por", teamMemberById(c.cerradoPor || c.by)?.name ?? "-"],
    ["Tipos de luminaria", String(c.items.length)],
    ["Total de luminarias", String(totalLum)],
  ];
  const cw = (W - 2 * M) / 4;
  meta.forEach((m, i) => {
    J.setFont("helvetica", "normal");
    J.setFontSize(7.5);
    J.setTextColor(...grey);
    J.text(m[0].toUpperCase(), M + i * cw, y + 4);
    J.setFont("helvetica", "bold");
    J.setFontSize(10.5);
    J.setTextColor(...ink);
    J.text(m[1], M + i * cw, y + 9.5);
  });
  y += 17;
  y = tablaHeader(y);

  for (let i = 0; i < c.items.length; i++) {
    const it = c.items[i];
    const l = luminarias.find((x) => x.id === it.lumId);
    J.setFont("helvetica", "normal");
    J.setFontSize(8);
    const nl = J.splitTextToSize(l?.nombre || it.nombre || "", COLS[2].w - 4).slice(0, 3);
    J.setFontSize(7.3);
    const specLines = COLS.map((col) =>
      col.k ? J.splitTextToSize((it as Record<string, unknown>)[col.k] as string | undefined || "-", col.w - 3).slice(0, 4) : null
    );
    const maxSpec = Math.max(0, ...specLines.map((x) => (x ? x.length : 0)));
    J.setFont("helvetica", "italic");
    J.setFontSize(7);
    const cl = it.comentario ? J.splitTextToSize(it.comentario, COLS[2].w - 4).slice(0, 4) : [];
    const rowH = Math.max(20, 9 + nl.length * 3.6 + cl.length * 3.2, 8 + maxSpec * 3.3);
    if (y + rowH > H - 22) {
      J.addPage();
      header();
      y = 32;
      y = tablaHeader(y);
    }
    if (i % 2 === 1) {
      J.setFillColor(244, 247, 248);
      J.rect(M, y, W - 2 * M, rowH, "F");
    }
    let x = M;
    const cy = y + rowH / 2 + 1.2;
    J.setFont("helvetica", "normal");
    J.setFontSize(8);
    J.setTextColor(...grey);
    J.text(String(i + 1), x + COLS[0].w / 2, cy, { align: "center" });
    x += COLS[0].w;
    if (l?.img) {
      const sz = l.iw && l.ih ? { w: l.iw, h: l.ih } : await imgSize(l.img);
      if (sz) {
        const bw = 15;
        const bh = 15;
        const r = Math.min(bw / sz.w, bh / sz.h);
        const iw = sz.w * r;
        const ih = sz.h * r;
        try {
          J.addImage(l.img, "JPEG", x + (COLS[1].w - iw) / 2, y + (rowH - ih) / 2, iw, ih);
        } catch {
          // imagen inválida — seguimos sin miniatura en esta fila
        }
      }
    }
    x += COLS[1].w;
    const ty = y + (rowH - (4 + nl.length * 3.6 + cl.length * 3.2)) / 2 + 3;
    J.setFont("helvetica", "bold");
    J.setFontSize(7.8);
    J.setTextColor(...ink);
    J.text(J.splitTextToSize(l?.codigo || it.codigo || "-", COLS[2].w - 4)[0], x + 2, ty);
    J.setFont("helvetica", "normal");
    J.setFontSize(8);
    J.setTextColor(55, 65, 81);
    J.text(nl, x + 2, ty + 4);
    if (cl.length) {
      J.setFont("helvetica", "italic");
      J.setFontSize(7);
      J.setTextColor(...green);
      J.text(cl, x + 2, ty + 4 + nl.length * 3.6);
    }
    x += COLS[2].w;
    for (let k = 3; k < COLS.length - 1; k++) {
      const ln = specLines[k] as string[];
      J.setFont("helvetica", "normal");
      J.setFontSize(7.3);
      J.setTextColor(...(ln.length === 1 && ln[0] === "-" ? grey : ink));
      J.text(ln, x + 2, y + (rowH - ln.length * 3.3) / 2 + 2.6);
      x += COLS[k].w;
    }
    J.setFont("helvetica", "bold");
    J.setFontSize(10.5);
    J.setTextColor(...green);
    J.text(String(it.cant), x + COLS[COLS.length - 1].w / 2, cy, { align: "center" });
    J.setDrawColor(229, 231, 235);
    J.setLineWidth(0.15);
    J.line(M, y + rowH, W - M, y + rowH);
    y += rowH;
  }

  if (y + 12 > H - 22) {
    J.addPage();
    header();
    y = 32;
  }
  J.setFillColor(244, 247, 248);
  J.rect(M, y + 2, W - 2 * M, 10, "F");
  J.setFont("helvetica", "bold");
  J.setFontSize(9.5);
  J.setTextColor(...ink);
  J.text("TOTAL DE LUMINARIAS", M + 3, y + 8.6);
  J.setTextColor(...green);
  J.setFontSize(12);
  J.text(meta[3][1], W - M - COLS[COLS.length - 1].w / 2, y + 8.8, { align: "center" });
  y += 14;

  if (c.mo || c.elev) {
    const alcRows: { t: string; v: string; ln: string[] }[] = [];
    if (c.mo) {
      const esp = c.mo === "si" ? (c.moEsp || "").trim() : "";
      alcRows.push({ t: "MANO DE OBRA", v: c.mo === "si" ? "Incluida" : "No incluida", ln: esp ? J.splitTextToSize(esp, W - 2 * M - 40) : [] });
    }
    if (c.elev) {
      const esp = c.elev === "si" ? (c.elevEsp || "").trim() : "";
      alcRows.push({ t: "ELEVADOR", v: c.elev === "si" ? "Se necesita" : "No se necesita", ln: esp ? J.splitTextToSize(esp, W - 2 * M - 40) : [] });
    }
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    let alcH = 9;
    alcRows.forEach((r) => {
      alcH += 6 + r.ln.length * 4 + (r.ln.length ? 1.5 : 0);
    });
    if (y + alcH > H - 22) {
      J.addPage();
      header();
      y = 32;
    }
    J.setFillColor(244, 247, 248);
    J.rect(M, y, W - 2 * M, alcH, "F");
    J.setFillColor(...green);
    J.rect(M, y, 0.9, alcH, "F");
    J.setFont("helvetica", "bold");
    J.setFontSize(7.5);
    J.setTextColor(...green);
    J.text("ALCANCE", M + 4, y + 5.5);
    let ay2 = y + 11;
    alcRows.forEach((r) => {
      J.setFont("helvetica", "bold");
      J.setFontSize(7.5);
      J.setTextColor(...grey);
      J.text(r.t, M + 4, ay2);
      J.setFontSize(9);
      J.setTextColor(...ink);
      J.text(r.v, M + 32, ay2);
      if (r.ln.length) {
        J.setFont("helvetica", "normal");
        J.setFontSize(8.5);
        J.setTextColor(55, 65, 81);
        J.text(r.ln, M + 32, ay2 + 5);
      }
      ay2 += 6 + r.ln.length * 4 + (r.ln.length ? 1.5 : 0);
    });
    y += alcH + 4;
  }

  if (c.obs && c.obs.trim()) {
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    const ol = J.splitTextToSize(c.obs.trim(), W - 2 * M - 8);
    const oh = 10 + ol.length * 4;
    if (y + oh > H - 22) {
      J.addPage();
      header();
      y = 32;
    }
    J.setFillColor(244, 247, 248);
    J.rect(M, y, W - 2 * M, oh, "F");
    J.setFillColor(...green);
    J.rect(M, y, 0.9, oh, "F");
    J.setFont("helvetica", "bold");
    J.setFontSize(7.5);
    J.setTextColor(...green);
    J.text("OBSERVACIONES", M + 4, y + 5.5);
    J.setFont("helvetica", "normal");
    J.setFontSize(8.5);
    J.setTextColor(...ink);
    J.text(ol, M + 4, y + 10.5);
  }

  // Plano con la ubicación de cada luminaria (hoja A4 horizontal), igual
  // que el original: solo se agrega si el cómputo tiene un plano cargado.
  if (c.plano && c.plano.fileId) {
    const psrc = await cargarPlanoData(c.plano.fileId);
    if (psrc) {
      const PW = 297;
      const PH = 210;
      J.addPage("a4", "landscape");
      if (logoSz) {
        let plh = 10;
        let plw = (plh * logoSz.w) / logoSz.h;
        if (plw > 34) {
          plw = 34;
          plh = (plw * logoSz.h) / logoSz.w;
        }
        try {
          J.addImage(ITELSA_LOGO_DATA_URL, "PNG", M, 9, plw, plh);
        } catch {
          // sin logo si falla, no rompemos el PDF
        }
      }
      J.setFont("helvetica", "bold");
      J.setFontSize(9);
      J.setTextColor(...green);
      J.text("UBICACIÓN DE LUMINARIAS", PW - M, 13, { align: "right" });
      J.setFont("helvetica", "normal");
      J.setFontSize(8.5);
      J.setTextColor(...grey);
      J.text(J.splitTextToSize(c.proyecto, 120)[0], PW - M, 18, { align: "right" });
      J.setDrawColor(209, 213, 219);
      J.setLineWidth(0.2);
      J.line(M, 22, PW - M, 22);
      J.setDrawColor(...green);
      J.setLineWidth(0.6);
      J.line(M, 22, M + 14, 22);

      const legW = 64;
      const ax = M;
      const ay = 27;
      const aw = PW - 2 * M - legW - 6;
      const ah = PH - ay - 16;
      const pw0 = c.plano.w || 1000;
      const ph0 = c.plano.h || 700;
      const sc = Math.min(aw / pw0, ah / ph0);
      const iw2 = pw0 * sc;
      const ih2 = ph0 * sc;
      const ix = ax + (aw - iw2) / 2;
      const iy = ay + (ah - ih2) / 2;
      try {
        J.addImage(psrc, "JPEG", ix, iy, iw2, ih2);
      } catch {
        // sin imagen de plano si falla la decodificación
      }
      J.setDrawColor(209, 213, 219);
      J.setLineWidth(0.2);
      J.rect(ix, iy, iw2, ih2);

      const idxOf = new Map<string, number>();
      c.items.forEach((it, i) => {
        if (it.uid) idxOf.set(it.uid, i);
      });
      const mr = Math.max(1.3, Math.min(2.4, iw2 / 120));
      (c.marcas || []).forEach((m) => {
        const i2 = idxOf.get(m.u);
        if (i2 === undefined) return;
        const mx = ix + m.x * iw2;
        const my = iy + m.y * ih2;
        J.setFillColor(...hexToRgb(colorDeItem(i2)));
        J.setDrawColor(255, 255, 255);
        J.setLineWidth(0.35);
        J.circle(mx, my, mr, "FD");
        J.setFont("helvetica", "bold");
        J.setFontSize(mr * 2.6);
        J.setTextColor(255, 255, 255);
        J.text(String(i2 + 1), mx, my + mr * 0.36, { align: "center" });
      });

      const lx = PW - M - legW;
      let ly = ay;
      J.setFont("helvetica", "bold");
      J.setFontSize(7.5);
      J.setTextColor(...green);
      J.text("REFERENCIAS", lx, ly + 3);
      ly += 7;
      const rowH2 = c.items.length > 14 ? Math.max(5.2, (ah - 10) / c.items.length) : 9;
      c.items.forEach((it, i) => {
        if (ly > PH - 18) return;
        const nUb = (c.marcas || []).filter((m) => m.u === it.uid).length;
        J.setFillColor(...hexToRgb(colorDeItem(i)));
        J.circle(lx + 2.4, ly + 1.2, 2.2, "F");
        J.setFont("helvetica", "bold");
        J.setFontSize(6.5);
        J.setTextColor(255, 255, 255);
        J.text(String(i + 1), lx + 2.4, ly + 2.1, { align: "center" });
        J.setFont("helvetica", "bold");
        J.setFontSize(7.5);
        J.setTextColor(...ink);
        J.text(J.splitTextToSize(it.codigo || it.nombre || "-", legW - 22)[0], lx + 6.5, ly + 1);
        J.setFont("helvetica", "normal");
        J.setFontSize(6.5);
        J.setTextColor(...grey);
        const sub2 = [it.potencia, it.angulo].filter(Boolean).join(" · ");
        if (rowH2 >= 8 && sub2) J.text(J.splitTextToSize(sub2, legW - 22)[0], lx + 6.5, ly + 4.4);
        J.setFont("helvetica", "bold");
        J.setFontSize(7.5);
        J.setTextColor(...green);
        J.text(`${nUb} / ${it.cant}`, PW - M, ly + 1.5, { align: "right" });
        ly += rowH2;
      });
      J.setFont("helvetica", "italic");
      J.setFontSize(6.5);
      J.setTextColor(...grey);
      J.text(J.splitTextToSize("Ubicadas en plano / cantidad computada.", legW), lx, Math.min(ly + 3, PH - 14));
    }
  }

  const n = J.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    J.setPage(p);
    J.setFont("helvetica", "normal");
    J.setFontSize(7.5);
    J.setTextColor(...grey);
    const pgW = J.internal.pageSize.getWidth();
    const pgH = J.internal.pageSize.getHeight();
    J.text(`ITELSA S.A.S. - Cómputo de luminarias - ${fecha}`, M, pgH - 10);
    J.text(`Página ${p} de ${n}`, pgW - M, pgH - 10, { align: "right" });
  }

  const safe = c.proyecto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  J.save(`Computo_${safe}_${c.cerrado || new Date().toISOString().slice(0, 10)}.pdf`);
}
