import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Note } from "@/models/Note";
import { NotasClient, type NoteItem } from "./notas-client";

// A diferencia de Vault, este módulo es para OWNER y ACCOUNTANT por igual
// (ver navItems en sidebar.tsx) — lo único "restringido" es que cada uno
// ve solo sus propias notas, filtrando siempre por session.user.id.
export default async function NotasPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  await connectDB();

  const notes = await Note.find({ user: session.user.id })
    .sort({ pinned: -1, updatedAt: -1 })
    .lean();

  const noteItems: NoteItem[] = notes.map((note) => ({
    id: note._id.toString(),
    title: note.title,
    content: note.content,
    color: note.color,
    pinned: note.pinned,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Notas</h1>
        <p className="text-sm text-muted-foreground">
          Notas rápidas y privadas — solo las ves vos.
        </p>
      </div>

      <NotasClient notes={noteItems} />
    </div>
  );
}