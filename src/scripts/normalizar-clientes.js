// Script de una sola corrida: recorre TODOS los clientes ya cargados y
// deja `nombre` en MAYÚSCULA y `razonSocial` en minúscula, igual que
// ahora queda todo lo nuevo que se cargue desde Ventas/Clientes (ver
// src/app/(dashboard)/clientes/actions.ts). Es seguro correrlo más de una
// vez: si un cliente ya está normalizado, lo salta.
//
// Uso (desde la carpeta del proyecto, en Git Bash):
//   node scripts/normalizar-clientes.js
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

  // Trabajamos directo sobre la colección (sin pasar por el modelo de
  // TypeScript, que este script plano no puede importar) — el nombre por
  // defecto que usa Mongoose para el modelo "Client" es "clients".
  const clients = mongoose.connection.collection("clients");

  const all = await clients.find({}).toArray();
  console.log(`Encontrados ${all.length} clientes.`);

  let updated = 0;
  let skipped = 0;

  for (const doc of all) {
    const currentNombre = typeof doc.nombre === "string" ? doc.nombre : "";
    const currentRazonSocial = typeof doc.razonSocial === "string" ? doc.razonSocial : undefined;

    const newNombre = currentNombre.trim().toUpperCase();
    const newRazonSocial =
      currentRazonSocial !== undefined ? currentRazonSocial.trim().toLowerCase() : undefined;

    const nombreChanged = newNombre !== currentNombre;
    const razonSocialChanged =
      currentRazonSocial !== undefined && newRazonSocial !== currentRazonSocial;

    if (!nombreChanged && !razonSocialChanged) {
      skipped += 1;
      continue;
    }

    const update = {};
    if (nombreChanged) update.nombre = newNombre;
    if (razonSocialChanged) update.razonSocial = newRazonSocial;

    await clients.updateOne({ _id: doc._id }, { $set: update });
    updated += 1;
    console.log(`- ${currentNombre || "(sin nombre)"} → actualizado`);
  }

  console.log(`\nListo. ${updated} cliente(s) actualizados, ${skipped} ya estaban bien.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error corriendo el script:", err);
  process.exit(1);
});