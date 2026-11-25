"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, ExternalLink, X, Pencil, Copy, Trash2 } from "lucide-react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";

// Portado de la sección "Info Util" del original: fichas tecnicas/catalogos
// (links con categoria) y notas de equipo, ambos en la MISMA coleccion
// "links" de Firestore, distinguidos por `kind` ("nota" = nota, ausente =
// link de catálogo) — así lo hace el original, a propósito ("asi no hace
// falta tocar reglas de Firestore", comentario literal del código), se
// mantiene igual acá. Filtro de pestaña: un link SIN `dept` es global (se ve
// en todas las pestañas); uno CON `dept` solo se ve en la suya — calcado del
// filtro real (`!l.dept || l.dept===curDept`).
const CATEGORIAS = ["Ficha tecnica", "Catalogo", "Proveedor", "Herramienta", "Otro"] as const;

type LinkDoc = {
  id: string;
  name: string;
  desc?: string;
  url?: string;
  cat?: string;
  dept?: string;
  kind?: "nota";
  text?: string;
  ts?: number;
  fecha?: string;
  by?: string;
};

function ahoraTexto(): string {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const d = new Date();
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} a las ${z(d.getHours())}:${z(d.getMinutes())}`;
}

function LinkForm({ dept, onDone }: { dept: string; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState<string>("Ficha tecnica");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Falta el nombre.");
      return;
    }
    setSaving(true);
    try {
      const ref = doc(collection(dbProyectos, "links"));
      const data: LinkDoc = { id: ref.id, name: name.trim(), desc: desc.trim(), url: url.trim(), cat, dept };
      await setDoc(ref, data);
      toast.success("Link agregado.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="in-name">Nombre</Label>
        <Input id="in-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Ficha técnica LED panel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="in-desc">Descripción (opcional)</Label>
        <Input id="in-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: Marca OSRAM, 60W" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="in-url">Link / URL</Label>
        <Input id="in-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="in-cat">Categoría</Label>
        <Select id="in-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Agregar"}
        </Button>
      </div>
    </form>
  );
}

function NotaCompose({ dept }: { dept: string }) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    const txt = texto.trim();
    if (!txt) return;
    setSaving(true);
    try {
      const ref = doc(collection(dbProyectos, "links"));
      const data: LinkDoc = {
        id: ref.id,
        kind: "nota",
        name: titulo.trim(),
        text: txt,
        dept,
        ts: Date.now(),
        fecha: ahoraTexto(),
      };
      await setDoc(ref, data);
      setTitulo("");
      setTexto("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" />
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Escribí la nota..." />
      <div className="flex justify-end">
        <Button size="sm" onClick={guardar} disabled={saving}>
          {saving ? "Guardando..." : "Guardar nota"}
        </Button>
      </div>
    </div>
  );
}

function NotaCard({ n }: { n: LinkDoc }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(n.name ?? "");
  const [texto, setTexto] = useState(n.text ?? "");
  const [busy, setBusy] = useState(false);

  async function guardar() {
    const txt = texto.trim();
    if (!txt) return;
    setBusy(true);
    try {
      await setDoc(doc(dbProyectos, "links", n.id), {
        ...n,
        name: titulo.trim(),
        text: txt,
        ts: Date.now(),
        fecha: ahoraTexto(),
      });
      setEditando(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function borrar() {
    if (!confirm("¿Eliminar esta nota?")) return;
    try {
      await deleteDoc(doc(dbProyectos, "links", n.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(n.text ?? "");
      toast.success("Copiado.");
    } catch {
      // Clipboard puede fallar por permisos del navegador — no es crítico.
    }
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" />
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={busy}>
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{n.name || "Nota"}</p>
        <div className="flex shrink-0 gap-1">
          <button type="button" title="Editar" onClick={() => setEditando(true)} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Copiar texto" onClick={copiar} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Eliminar" onClick={borrar} className="rounded p-1 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.text}</p>
      <p className="text-xs text-muted-foreground">
        {n.by ? `${n.by} · ` : ""}
        {n.fecha}
      </p>
    </div>
  );
}

export function InfoUtil({ dept = "pipeline" }: { dept?: string }) {
  const deptLabel = dept === "proyectos" ? "Arquitectura" : "Proyectos";
  const [items, setItems] = useState<LinkDoc[] | null>(null);
  const [agregandoOpen, setAgregandoOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(dbProyectos, "links"),
      (snap) => setItems(snap.docs.map((d) => d.data() as LinkDoc)),
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con la base de Proyectos.");
      }
    );
    return () => unsub();
  }, []);

  if (items === null) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  // Igual que el original: un link/nota sin `dept` es global (se ve en
  // todas las pestañas), uno con `dept` solo en la suya.
  const propios = items.filter((l) => !l.dept || l.dept === dept);
  const links = propios.filter((l) => l.kind !== "nota");
  const notas = propios.filter((l) => l.kind === "nota").sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

  async function borrarLink(id: string) {
    try {
      await deleteDoc(doc(dbProyectos, "links", id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Fichas técnicas, catálogos y links importantes</h2>
          </div>
          <Button size="sm" onClick={() => setAgregandoOpen(true)}>
            <Plus className="h-4 w-4" />
            Agregar link
          </Button>
        </div>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay links en {deptLabel}.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {links.map((l) => (
              <div key={l.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    {l.desc && <p className="text-xs text-muted-foreground">{l.desc}</p>}
                  </div>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => borrarLink(l.id)}
                    className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{l.cat}</span>
                {l.url && (
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{l.url}</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Notas</h2>
          <p className="text-xs text-muted-foreground">Datos, contactos y apuntes del equipo</p>
        </div>
        <NotaCompose dept={dept} />
        <div className="flex flex-col gap-2">
          {notas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todavía no hay notas en {deptLabel}.</p>
          ) : (
            notas.map((n) => <NotaCard key={n.id} n={n} />)
          )}
        </div>
      </div>

      <Dialog open={agregandoOpen} onOpenChange={setAgregandoOpen} title="Agregar a Info Útil" className="max-w-lg">
        <LinkForm dept={dept} onDone={() => setAgregandoOpen(false)} />
      </Dialog>
    </div>
  );
}
