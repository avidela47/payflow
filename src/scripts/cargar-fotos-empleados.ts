import "dotenv/config";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Employee } from "@/models/Employee";

// Script de un solo uso (2026-11-26): Ariel generó retratos con IA para el
// equipo y los renombró a mano en su disco (D:\DRIVE ARIEL\ARIEL\Fotos\
// ChatGpt\empleados\<nombre>.png). Esto busca, para cada nombre, la ficha
// de Empleados que corresponde (primero por User.employeeId si la cuenta
// ya está linkeada, si no por nombre) y le carga esa foto — mismo campo
// `Employee.foto` que ya usa el formulario de Empleados, mismo mecanismo
// de archivo (UUID en public/uploads/empleados/). Si la cuenta de login
// (Francisco/Melina/Fabio/Cristian/Pajarito, ver create-users.ts) todavía
// no tiene `employeeId` pero SÍ aparece una ficha con ese nombre, la
// conecta de paso.
//
// Corre en dos modos:
//   npx tsx src/scripts/cargar-fotos-empleados.ts            → solo informa, no escribe nada
//   npx tsx src/scripts/cargar-fotos-empleados.ts --apply     → aplica los cambios
//
// IMPORTANTE: este script escribe el archivo de la foto en el disco de
// DONDE SE CORRE. Si lo corrés en tu máquina (que es donde están las
// fotos), el archivo queda en TU public/uploads/empleados/, no en el del
// VPS — son dos filesystems separados (esa carpeta está en .gitignore, no
// viaja con git push). Después de correrlo con --apply hay que copiar los
// archivos nuevos al VPS a mano (instrucciones al final del output).
// Correr una vez y después borrar este archivo.

const SOURCE_DIR = "D:\\DRIVE ARIEL\\ARIEL\\Fotos\\ChatGpt\\empleados";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "empleados");

const PERSONAS = [
  { username: "ariel", nombre: "ariel", file: "ariel.png" },
  { username: "ruben", nombre: "ruben", file: "ruben.png" },
  { username: "candelaria", nombre: "candelaria", file: "candelaria.png" },
  { username: "florencia", nombre: "florencia", file: "florencia.png" },
  { username: "sofia", nombre: "sofia", file: "sofia.png" },
  { username: "lionel", nombre: "lionel", file: "lionl.png" }, // así quedó el archivo (sin la "e")
  { username: "francisco", nombre: "francisco", file: "francisco.png" },
  { username: "melina", nombre: "melina", file: "melina.png" },
  { username: "fabio", nombre: "fabio", file: "fabio.png" },
  { username: "cristian", nombre: "cristian", file: "cristian.png" },
  { username: "pajarito", nombre: "pajarito", file: "pajarito.png" },
];

function sinAcentos(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDB();

  console.log(apply ? "=== MODO APLICAR (va a escribir cambios) ===" : "=== MODO INFORME (no escribe nada) ===");
  console.log("");

  let aplicados = 0;
  let sinFicha = 0;
  let sinArchivo = 0;

  for (const p of PERSONAS) {
    const sourcePath = path.join(SOURCE_DIR, p.file);
    const fileExists = fs.existsSync(sourcePath);

    const user = await User.findOne({ email: p.username });

    let employee = null;
    if (user?.employeeId) {
      employee = await Employee.findById(user.employeeId);
    }
    if (!employee) {
      const candidatos = await Employee.find({});
      employee = candidatos.find((e) => sinAcentos(e.nombre) === sinAcentos(p.nombre)) ?? null;
    }

    // 2026-11-26, Ariel: no hace falta ficha de Empleados para tener foto
    // al loguearse — si no hay ficha, la foto se guarda directo en la
    // cuenta de login (User.foto), sin pedir apellido/categoría de nadie.
    const estado: string[] = [];
    estado.push(`[${p.username}]`);
    estado.push(fileExists ? "archivo OK" : "⚠ ARCHIVO NO ENCONTRADO en " + sourcePath);
    estado.push(user ? "cuenta de login OK" : "⚠ no existe cuenta de login con ese email");
    if (employee) {
      estado.push(`ficha encontrada: "${employee.nombre} ${employee.apellido}" (foto ${employee.foto ? "ya tenía" : "vacía"})`);
      if (user && !user.employeeId) estado.push("→ se va a linkear employeeId");
    } else {
      estado.push(`sin ficha en Empleados → se usa foto directo en la cuenta (User.foto, ${user?.foto ? "ya tenía" : "vacía"})`);
    }
    console.log(estado.join(" | "));

    if (!fileExists) {
      sinArchivo++;
      continue;
    }
    if (!user) {
      sinFicha++;
      continue;
    }
    if (!employee) {
      sinFicha++;
    }

    if (apply) {
      // A quien ya tenía una foto real cargada (en Employee o en User) NO
      // se la tocamos ni borramos — mismo criterio pedido por Ariel.
      const yaTeniaFoto = employee ? !!employee.foto : !!user.foto;
      if (yaTeniaFoto) {
        console.log(`   = sin cambios (ya tenía foto, no se reemplaza)`);
      } else {
        await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
        const ext = path.extname(p.file) || ".png";
        const filename = `${randomUUID()}${ext}`;
        const bytes = await fs.promises.readFile(sourcePath);
        await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), bytes);
        const fotoPath = `/uploads/empleados/${filename}`;

        if (employee) {
          employee.foto = fotoPath;
          await employee.save();
        } else {
          user.foto = fotoPath;
          await user.save();
        }
        aplicados++;
        console.log(`   ✓ aplicado: ${fotoPath}`);
      }

      if (employee && user && !user.employeeId) {
        user.employeeId = employee._id;
        await user.save();
        console.log(`   ✓ employeeId linkeado`);
      }
    }
  }

  console.log("");
  console.log(`Resumen: ${aplicados} aplicados, ${sinFicha} sin ficha en Empleados (foto directo en la cuenta), ${sinArchivo} sin archivo de foto.`);
  if (apply && aplicados > 0) {
    console.log("");
    console.log("Los archivos quedaron en tu public/uploads/empleados/ LOCAL. Para que se vean en");
    console.log("payflow.itelsasas.com hay que copiarlos también al VPS, por ejemplo con scp desde Git Bash:");
    console.log('  scp -r "public/uploads/empleados" usuario@tu-vps:/var/www/payflow/public/uploads/');
    console.log("(ajustá usuario@tu-vps y la ruta del proyecto en el VPS a como los tengas vos).");
  }
  if (!apply) {
    console.log("");
    console.log("Esto fue solo el informe. Si está todo bien, corré de nuevo con --apply para aplicar.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
