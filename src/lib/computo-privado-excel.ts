// Excel del cómputo valorizado — mismo dato que czPdf (computo-privado-pdf.ts)
// pero en una planilla real para poder reordenar/filtrar/sumar en Excel.
// 2026-11-25, pedido de Ariel. Mismo patrón que exportarExcel() en
// pipeline-client.tsx: import dinámico de "xlsx" (ya es dependencia del
// proyecto, no se suma nada nuevo), aoa_to_sheet + writeFile.
import { czNum, czTotal, type ComputoValorizado } from "./computo-privado";

function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

export async function czExcel(z: ComputoValorizado): Promise<void> {
  const XLSX = await import("xlsx");

  // Mismo filtro que czPdf: descarta filas completamente vacías (ítem
  // agregado y borrado a medias, etc.)
  const items = (z.items || []).filter((it) => (it.desc || "").trim() || (it.det || "").trim() || czNum(it.pu));

  const rows: (string | number)[][] = [
    ["CÓMPUTO VALORIZADO"],
    ["Proyecto", z.proyecto || ""],
    ["Fecha", fmtFecha(z.fecha)],
    ["Moneda", z.moneda === "ARS" ? "Pesos argentinos ($)" : "Dólares estadounidenses (US$)"],
    [],
    ["#", "Item", "Detalle", "Cantidad", "Precio unitario", "Subtotal"],
  ];

  items.forEach((it, i) => {
    const cant = czNum(it.cant);
    const pu = czNum(it.pu);
    rows.push([i + 1, it.desc || "", it.det || "", cant, pu, cant * pu]);
  });

  rows.push([]);
  rows.push(["", "", "", "", "TOTAL", czTotal(z)]);

  if ((z.notas || "").trim()) {
    rows.push([]);
    rows.push(["Notas y condiciones"]);
    rows.push([z.notas!.trim()]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Anchos de columna a mano — aoa_to_sheet no los infiere solo.
  ws["!cols"] = [{ wch: 4 }, { wch: 45 }, { wch: 45 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Computo valorizado");

  const safe = (z.proyecto || "").replace(/[^\w-]+/g, "_");
  XLSX.writeFile(wb, `Computo_valorizado_${safe}_${z.fecha || ""}.xlsx`);
}
