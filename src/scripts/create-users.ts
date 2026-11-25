import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, RESTRICTABLE_MODULES, type RestrictableModule, type Role } from "@/models/User";

// Script para crear/actualizar usuarios con acceso acotado por "grupo"
// (en vez de tener que listar moduleKey por moduleKey cada vez que Ariel
// pide un usuario nuevo). 2026-11-25, primer caso: Sofia.
//
// Cómo funciona el permiso en este sistema (ya existía, no es nuevo de
// este script): restrictedModules es una lista de BLOQUEO, no de
// permiso — un módulo ahí = ESCONDIDO para ese usuario. Lo que no tiene
// moduleKey en sidebar.tsx (Dashboard, Clientes/Proveedores/Ventas/Compras
// de COMERCIAL, Agenda/Calendario/Notas de UTILIDADES) no se puede
// restringir nunca — queda visible para cualquier usuario siempre. Por
// eso los grupos "comercial" y "utilidades" de acá abajo solo necesitan
// listar lo que SÍ tiene moduleKey dentro de esa sección.
//
// Los grupos calcan las secciones visuales del sidebar (components/
// sidebar.tsx) 1 a 1, para que sea fácil chequear cruzando ambos archivos
// si se agrega un módulo nuevo más adelante.
const ACCESS_GROUPS: Record<string, RestrictableModule[]> = {
  // Reportes no tiene sección (acceso global junto al Dashboard) pero sí
  // moduleKey — queda como grupo aparte, no incluido en ningún otro.
  reportes: ["reportes"],
  proyectos: [
    "weeklys",
    "pipeline",
    "computos",
    "arquitectura",
    "accesos",
    "gestion-de-proyectos",
    "computo-privado",
    "marketing",
  ],
  comercial: [], // Clientes/Proveedores/Ventas/Compras: sin moduleKey, siempre visibles
  finanzas: ["empleados", "sueldos", "costos-fijos", "pagos", "cheques", "caja-chica", "viaticos"],
  utilidades: ["vault"], // Agenda/Calendario/Notas: sin moduleKey, siempre visibles
  produccion: ["componentes", "recetas", "fabricar", "movimientos-componentes", "proyectos"],
  stock: ["sensores", "luminarias", "herramientas", "materiales"],
  comercialPlanta: ["presupuestos", "ordenes", "reparaciones", "remitos", "despachos", "recibos"],
  vales: ["vales"],
};

type UserToCreate = {
  name: string;
  email: string; // se usa como "usuario" de login, no hace falta que sea un email real (ver seed.ts: "ariel", "admin")
  password: string;
  role: Role;
  // true = mismo nivel que Ariel (OWNER, sin ningún módulo restringido) —
  // ignora allowedGroups. 2026-11-25: Candelaria y Rubén piden esto
  // explícitamente ("mismo nivel de Ariel").
  fullAccess?: true;
  allowedGroups?: (keyof typeof ACCESS_GROUPS)[];
};

// Acá se suman los usuarios a crear/actualizar. Correr `npm run create-users`
// de nuevo después de agregar uno (es upsert por email — no duplica ni
// pisa a los que ya estaban, salvo que se repita el mismo email).
const USERS_TO_CREATE: UserToCreate[] = [
  {
    name: "Sofia",
    email: "sofia",
    password: "Sofia2026$",
    role: "ACCOUNTANT",
    allowedGroups: ["proyectos", "comercial", "utilidades"],
  },
  {
    name: "Candelaria",
    email: "candelaria",
    password: "Candelaria2026$",
    role: "OWNER",
    fullAccess: true,
  },
  {
    name: "Ruben",
    email: "ruben",
    password: "Ruben2026$",
    role: "OWNER",
    fullAccess: true,
  },
  {
    name: "Florencia",
    email: "florencia",
    password: "Florencia2026$",
    role: "OWNER",
    fullAccess: true,
  },
  {
    name: "Francisco",
    email: "francisco",
    password: "Francisco2026$",
    role: "ACCOUNTANT",
    // Pedido de Ariel: solo Dashboard (siempre visible, no hace falta
    // listarlo), Proyectos y Utilidades (acá, Vault — Agenda/Calendario/
    // Notas no tienen moduleKey y ya se ven siempre).
    allowedGroups: ["proyectos", "utilidades"],
  },
  {
    name: "Melina",
    email: "melina",
    password: "melina2026$",
    role: "ACCOUNTANT",
    allowedGroups: ["proyectos", "utilidades"],
  },
  {
    name: "Lionel",
    email: "lionel",
    password: "Lionel2026$",
    role: "ACCOUNTANT",
    allowedGroups: ["reportes", "comercial", "utilidades", "produccion", "stock", "comercialPlanta"],
  },
];

function restrictedModulesFor(u: UserToCreate): RestrictableModule[] {
  if (u.fullAccess) return [];
  const allowedSet = new Set((u.allowedGroups ?? []).flatMap((g) => ACCESS_GROUPS[g] ?? []));
  return RESTRICTABLE_MODULES.filter((m) => !allowedSet.has(m));
}

async function main() {
  await connectDB();

  for (const u of USERS_TO_CREATE) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const restrictedModules = restrictedModulesFor(u);

    await User.findOneAndUpdate(
      { email: u.email },
      {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        active: true,
        restrictedModules,
      },
      { upsert: true }
    );

    console.log(
      `Usuario "${u.name}" (${u.email}) listo. Acceso: ${u.fullAccess ? "TOTAL (como Ariel)" : (u.allowedGroups ?? []).join(", ") || "ninguno"}. Bloqueado: ${restrictedModules.join(", ") || "nada"}.`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
