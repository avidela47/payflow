// Script de una sola corrida: le asigna código correlativo (CLI-001,
// CLI-002, ...) a los clientes que ya tenés cargados y que todavía no
// tienen — de ahí en adelante, cada cliente nuevo lo recibe solo al
// guardarse (ver getNextSequence en src/models/Counter.ts). Es seguro
// correrlo más de una vez: a los que ya tienen código no los toca.
//
// Uso (desde la carpeta del proyecto, en Git Bash):
//   node src/scripts/asignar-codigos-clientes.js
//
// Lee la conexión real de tu .env (MONGODB_URI) — no toca nada más.

require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (!MONGODB_URI) {
    console.error("Falta MONGODB_URI en el .env. Corré este script desde la carpeta del proyecto.");
    process.exit(1);
  }

  console.log("Conectando a MongoDB...");
  await mongoose.connect(MONGODB_URI);

  const clients = mongoose.connection.collection("clients");
  const counters = mongoose.connection.collection("counters");

  const pending = await clients
    .find({ codigo: { $exists: false } })
    .sort({ createdAt: 1 })
    .toArray();
  console.log(`${pending.length} cliente(s) sin código.`);

  // Si ya hay clientes con código (de una corrida anterior parcial),
  // arranca después del más alto en vez de reiniciar desde CLI-001.
  const highest = await clients
    .find({ codigo: { $exists: true } })
    .sort({ codigo: -1 })
    .limit(1)
    .toArray();
  let seq = 0;
  if (highest.length > 0) {
    const match = /^CLI-(\d+)$/.exec(highest[0].codigo);
    if (match) seq = parseInt(match[1], 10);
  }

  for (const doc of pending) {
    seq += 1;
    const codigo = `CLI-${String(seq).padStart(3, "0")}`;
    await clients.updateOne({ _id: doc._id }, { $set: { codigo } });
    console.log(`- ${doc.nombre} → ${codigo}`);
  }

  // Deja el contador (el que usa la app para el próximo cliente nuevo) en
  // este mismo número, así arranca justo después sin repetir ni saltar.
  await counters.updateOne({ _id: "client" }, { $max: { seq } }, { upsert: true });

  console.log(`\nListo. Contador en ${seq}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error corriendo el script:", err);
  process.exit(1);
});