import "dotenv/config";
import { connectDB } from "@/lib/db";
import { Componente } from "@/models/Componente";
import type { ComponenteUnidad } from "@/lib/componente-unidades";

// Script de uso puntual (2026-11-27): recuento físico de Componentes hecho
// en papel por Ariel (planillas "Tetra Polar Siemens 125A" y "Arandelas/
// Bulones/Borneras/Cajas") — ver conversación. Solo incluye acá lo que
// quedó 100% confirmado con Ariel; lo que quedó dudoso (varias Arandelas,
// Autoperforantes, Bornera BKF, Caja P320, etc. de la misma planilla) NO
// está en esta lista a propósito — se agrega en una vuelta aparte cuando
// él confirme esos valores, o los carga directo en la app.
//
// Tres tipos de operación:
//   actualizar: busca por descripcion (match exacto, normalizado) y pisa
//     stockActual con el valor contado — NO suma, reemplaza (confirmado
//     con Ariel: "cantidad nueva" = recuento físico real).
//   eliminar: busca por descripcion y borra el documento entero —
//     confirmado con Ariel: la tornillería tachada en la planilla "ya no
//     va más".
//   crear: componente nuevo que no existía — código propuesto por mí
//     siguiendo el patrón de los códigos existentes (TET-, TUE-, etc.);
//     Ariel lo revisa en el informe antes de aplicar y lo corrige acá si
//     no le cierra.
//
// Corre en dos modos, igual que los scripts anteriores:
//   npx tsx src/scripts/actualizar-stock-componentes.ts            → informa
//   npx tsx src/scripts/actualizar-stock-componentes.ts --apply     → aplica

const ACTUALIZAR: { descripcion: string; stockNuevo: number }[] = [
  { descripcion: "Tetrapolar AEA 40A", stockNuevo: 3 },
  { descripcion: "Tetrapolar CHNT 80A", stockNuevo: 2 },
  // Tetrapolar Schneider 25A: afuera — el sistema tiene 4, no 38. Nunca
  // confirmado por Ariel, era una suposición mía. Pendiente.
  { descripcion: "Arandela Grower 3/8", stockNuevo: 94 },
  // Bipolar 10A SH: afuera — el sistema tiene 118, no 31. Nunca
  // confirmado por Ariel, era una suposición mía. Pendiente.
  { descripcion: "Bipolar 10A usada", stockNuevo: 2 },
  { descripcion: "Bornera Descarga Tierra 7 Vias para riel din", stockNuevo: 33 },
  { descripcion: "Bornera Push 3 vias", stockNuevo: 86 },
  { descripcion: "Buje Aluminio", stockNuevo: 2179 },
  { descripcion: "Caja estanca 71x71x50 perforada", stockNuevo: 0 },
];

const ELIMINAR: string[] = [
  "Tornillo de metal",
  "Tornillo M3x10",
  "Tornillo M3x12",
  "Tornillo M3x6",
  "Tornillo M3x8",
  "Tornillo M4x10",
  "Tornillo M4x18",
  "Tornillo M5x20",
  "Tuerca 1/2",
  "Tuerca 1/4",
  "Tuerca 3/8",
  "Zoloda BPN 2,5 Azul",
  "Zoloda BPN 2,5 Gris",
  "Caja estanca PR 996/54",
];

const CREAR: { codigo: string; descripcion: string; unidad: ComponenteUnidad; stockActual: number }[] = [
  { codigo: "TET-SIE-125A", descripcion: "Tetrapolar Siemens 125A", unidad: "UNIDAD", stockActual: 1 },
  { codigo: "TUE-8MM-DOR", descripcion: "Tuerca 8mm Dorada", unidad: "UNIDAD", stockActual: 483 },
  // No existían con ese nombre exacto en el sistema (salieron "NO
  // ENCONTRADO" en el informe) — se crean como nuevos en vez de
  // actualizar algo que no está.
  { codigo: "C-E-92-92-54", descripcion: "Caja estanca 92x92x54", unidad: "UNIDAD", stockActual: 12 },
  { codigo: "C-E-122-166-67-P", descripcion: "Caja estanca 122x166x67 perforada", unidad: "UNIDAD", stockActual: 18 },
];

function sinAcentos(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDB();

  console.log(apply ? "=== MODO APLICAR (va a escribir cambios) ===" : "=== MODO INFORME (no escribe nada) ===");
  console.log("");

  const todos = await Componente.find({}).select("codigo descripcion stockActual").lean();

  console.log(`--- ACTUALIZAR (${ACTUALIZAR.length}) ---`);
  for (const row of ACTUALIZAR) {
    const match = todos.find((c) => sinAcentos(c.descripcion) === sinAcentos(row.descripcion));
    if (!match) {
      console.log(`[${row.descripcion}] ⚠ NO ENCONTRADO — no se toca nada, revisar nombre exacto en el sistema.`);
      continue;
    }
    const cambia = match.stockActual !== row.stockNuevo;
    console.log(
      `[${match.codigo}] "${match.descripcion}" — stock actual: ${match.stockActual} ${
        cambia ? `→ ${apply ? "se actualiza a" : "pasaría a"} ${row.stockNuevo}` : "= sin cambios"
      }`
    );
    if (apply && cambia) {
      await Componente.updateOne({ _id: match._id }, { stockActual: row.stockNuevo });
    }
  }

  console.log("");
  console.log(`--- ELIMINAR (${ELIMINAR.length}) ---`);
  for (const descripcion of ELIMINAR) {
    const match = todos.find((c) => sinAcentos(c.descripcion) === sinAcentos(descripcion));
    if (!match) {
      console.log(`[${descripcion}] ⚠ NO ENCONTRADO — no hay nada que borrar con ese nombre exacto.`);
      continue;
    }
    console.log(
      `[${match.codigo}] "${match.descripcion}" (stock actual: ${match.stockActual}) → ${
        apply ? "SE BORRA" : "se borraría"
      }`
    );
    if (apply) {
      await Componente.deleteOne({ _id: match._id });
    }
  }

  console.log("");
  console.log(`--- CREAR (${CREAR.length}) ---`);
  for (const nuevo of CREAR) {
    const yaExiste = todos.find((c) => c.codigo === nuevo.codigo || sinAcentos(c.descripcion) === sinAcentos(nuevo.descripcion));
    if (yaExiste) {
      console.log(`[${nuevo.codigo}] "${nuevo.descripcion}" — ⚠ ya existe como [${yaExiste.codigo}], no se crea de nuevo.`);
      continue;
    }
    console.log(
      `[${nuevo.codigo}] "${nuevo.descripcion}" — unidad ${nuevo.unidad}, stock ${nuevo.stockActual} → ${
        apply ? "SE CREA" : "se crearía"
      }`
    );
    if (apply) {
      await Componente.create(nuevo);
    }
  }

  console.log("");
  if (!apply) {
    console.log("Esto fue solo el informe. Revisá cada línea y corré de nuevo con --apply para aplicar.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
