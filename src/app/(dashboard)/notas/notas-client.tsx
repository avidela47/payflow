"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { NOTE_COLORS, type NoteColor } from "@/lib/note-colors";
import { createNote, updateNote, deleteNote, toggleNotePinned } from "./actions";

export type NoteItem = {
  id: string;
  title?: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
};

// Strings de clase completas y literales (no interpoladas) para cada color:
// el scanner de Tailwind no ejecuta el JS, así que un `bg-${color}-100`
// desaparecería del build de producción. Con este lookup, las clases
// aparecen tal cual en el archivo y quedan incluidas.
const COLOR_STYLES: Record<NoteColor, { card: string; swatch: string; ring: string }> = {
  yellow: {
    card: "bg-yellow-100 border-yellow-300",
    swatch: "bg-yellow-300",
    ring: "ring-yellow-500",
  },
  pink: {
    card: "bg-pink-100 border-pink-300",
    swatch: "bg-pink-300",
    ring: "ring-pink-500",
  },
  blue: {
    card: "bg-blue-100 border-blue-300",
    swatch: "bg-blue-300",
    ring: "ring-blue-500",
  },
  green: {
    card: "bg-green-100 border-green-300",
    swatch: "bg-green-300",
    ring: "ring-green-500",
  },
  purple: {
    card: "bg-purple-100 border-purple-300",
    swatch: "bg-purple-300",
    ring: "ring-purple-500",
  },
  orange: {
    card: "bg-orange-100 border-orange-300",
    swatch: "bg-orange-300",
    ring: "ring-orange-500",
  },
};

function ColorPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: NoteColor;
}) {
  const [selected, setSelected] = useState<NoteColor>(defaultValue);
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Color</Label>
      <input type="hidden" name={name} value={selected} />
      <div className="flex gap-2">
        {NOTE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => setSelected(color)}
            className={`h-7 w-7 rounded-full border ${COLOR_STYLES[color].swatch} ${
              selected === color ? `ring-2 ring-offset-2 ${COLOR_STYLES[color].ring}` : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function NotasClient({ notes }: { notes: NoteItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NoteItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NoteItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createNote(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Nota creada.");
    setCreatingOpen(false);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    setEditing(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateNote(editTarget.id, formData);
    setEditing(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Nota actualizada.");
    setEditTarget(null);
    router.refresh();
  }

  async function performDelete(note: NoteItem) {
    setDeletingId(note.id);
    const result = await deleteNote(note.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Nota borrada.");
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleTogglePin(note: NoteItem) {
    setPinningId(note.id);
    const result = await toggleNotePinned(note.id, !note.pinned);
    setPinningId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva nota
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Todavía no tenés notas. Creá la primera con &quot;Nueva nota&quot;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {notes.map((note) => {
            const styles = COLOR_STYLES[note.color];
            return (
              <div
                key={note.id}
                className={`flex flex-col gap-2 rounded-lg border p-4 shadow-sm ${styles.card}`}
              >
                <div className="flex items-start justify-between gap-2">
                  {note.title ? (
                    <h3 className="font-semibold text-neutral-800 break-words">{note.title}</h3>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => handleTogglePin(note)}
                    disabled={pinningId === note.id}
                    className="shrink-0 rounded-md p-1 text-neutral-600 hover:bg-black/10"
                    aria-label={note.pinned ? "Desanclar" : "Anclar"}
                  >
                    {note.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                  </button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">
                  {note.content}
                </p>
                <div className="mt-auto flex justify-end gap-1 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-neutral-700 hover:bg-black/10"
                    onClick={() => setEditTarget(note)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(note)}
                  >
                    Borrar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={creatingOpen}
        onOpenChange={setCreatingOpen}
        title="Nueva nota"
        className="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Título (opcional)</Label>
            <Input id="title" name="title" placeholder="Ej: Pendiente cliente X" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">Nota</Label>
            <Textarea id="content" name="content" required rows={4} />
          </div>
          <ColorPicker name="color" defaultValue="yellow" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreatingOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar nota"
        className="max-w-md"
      >
        {editTarget && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-title">Título (opcional)</Label>
              <Input id="edit-title" name="title" defaultValue={editTarget.title} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-content">Nota</Label>
              <Textarea
                id="edit-content"
                name="content"
                required
                rows={4}
                defaultValue={editTarget.content}
              />
            </div>
            <ColorPicker name="color" defaultValue={editTarget.color} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editing}>
                {editing ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar nota"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar esta nota? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingId === deleteTarget.id}
                onClick={() => performDelete(deleteTarget)}
              >
                {deletingId === deleteTarget.id ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}