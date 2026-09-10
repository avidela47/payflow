import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { VaultEntry } from "@/models/Vault";
import { VaultClient, type VaultEntryItem } from "./vault-client";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Módulo aparte y de acceso restringido — ver ARCHITECTURE.md, sección 4.
// Por default solo OWNER entra acá. Un ACCOUNTANT con un VaultGrant puntual
// se resolvería filtrando VaultEntry por esos grants — el modelo ya está
// listo para eso, pero no se usa todavía (queda para cuando haga falta).
export default async function VaultPage() {
  const session = await getSession();

  if (session?.user?.role !== "OWNER") {
    redirect("/");
  }

  await connectDB();

  // Ojo: nunca pedimos encryptedValue/iv/authTag acá — la lista solo
  // necesita metadata. El valor real se descifra server-side y solo al
  // pedir "Revelar" (ver actions.ts).
  const entries = await VaultEntry.find({})
    .select("service username link notes updatedAt")
    .sort({ service: 1 })
    .lean();

  const entryItems: VaultEntryItem[] = entries.map((entry) => ({
    id: entry._id.toString(),
    service: entry.service,
    username: entry.username,
    link: entry.link,
    notes: entry.notes,
    updatedAtLabel: formatDateTime(entry.updatedAt),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Vault de Credenciales</h1>
        <p className="text-sm text-muted-foreground">
          Acceso restringido a OWNER. Cifrado con AES-256-GCM — la clave nunca se muestra sin
          pedirlo explícitamente.
        </p>
      </div>

      <VaultClient entries={entryItems} />
    </div>
  );
}