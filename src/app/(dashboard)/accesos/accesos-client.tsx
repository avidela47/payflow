"use client";

// Accesos — caja fuerte COMPARTIDA de credenciales del equipo (wifi,
// hosting, Mercado Libre, etc.), con un único PIN de equipo que desbloquea
// todo para cualquiera que lo sepa. A propósito independiente del Vault
// de PayFlow (que es privado por usuario) — ver conversación 2026-11-25.
// Port de renderAccesosBoard/renderAccList/openAccModal/saveAcceso/
// deleteAcceso (líneas 1914-2036 del original). Colección Firestore propia
// "accesos" (dbProyectos), cada doc {id, iv, ct, ts, by} — el contenido
// (nombre/cat/link/usuario/clave/notas) viaja cifrado, nunca en texto plano
// ni en Firestore ni en la red.
//
// Igual que el original: se desbloquea por sesión (la clave vive solo en
// memoria de React, nunca en localStorage/sessionStorage) y se vuelve a
// bloquear al salir de la pantalla o recargarla — no hay nada que persista
// el desbloqueo a propósito.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { accUnlock, accesoCifrar, accesoDescifrar, type AccesoDatos } from "@/lib/accesos-crypto";
import { logActivity } from "@/lib/proyectos-activity";
import { useQuienSos, QuienSos } from "../pipeline/quien-sos";
import { Lock, KeyRound, Search, Plus, Pencil, Copy, Eye, EyeOff, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";

type AccesoRaw = { id: string; iv: string; ct: string; ts?: number; by?: string };
type AccesoItem = AccesoDatos & { id: string; _err?: boolean };

function matchFiltro(it: AccesoItem, f: string): boolean {
  if (!f) return true;
  const hay = [it.nombre, it.usuario, it.link, it.cat, it.notas].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(f);
}

function PinLock({ onUnlock }: { onUnlock: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function intentar() {
    if (!pin.trim()) return;
    setLoading(true);
    setErr("");
    try {
      await onUnlock(pin.trim());
    } catch {
      setErr("Contraseña incorrecta.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <h2 className="text-sm font-semibold">Accesos</h2>
      <p className="text-xs text-muted-foreground">Ingresá la contraseña de equipo para ver usuarios, contraseñas y links.</p>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Contraseña"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void intentar()}
        className="text-center"
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button className="w-full" disabled={loading} onClick={() => void intentar()}>
        {loading ? "Verificando..." : "Entrar"}
      </Button>
    </div>
  );
}

function AccesoModal({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial: AccesoItem | null;
  onClose: () => void;
  onSave: (datos: AccesoDatos) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [cat, setCat] = useState("");
  const [link, setLink] = useState("");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(initial?.nombre ?? "");
    setCat(initial?.cat ?? "");
    setLink(initial?.link ?? "");
    setUsuario(initial?.usuario ?? "");
    setClave(initial?.clave ?? "");
    setNotas(initial?.notas ?? "");
  }, [open, initial]);

  async function guardar() {
    if (!nombre.trim()) {
      toast.error("Poné un nombre (ej: Mercado Libre, Hosting, Wifi oficina).");
      return;
    }
    setSaving(true);
    try {
      await onSave({ nombre: nombre.trim(), cat: cat.trim(), link: link.trim(), usuario: usuario.trim(), clave: clave.trim(), notas: notas.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={initial ? "Editar acceso" : "Nuevo acceso"} className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mercado Libre, Hosting, Wifi oficina" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Categoría (opcional)</Label>
          <Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Ej: Hosting, Redes, Proveedor" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Link</Label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Usuario</Label>
          <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Contraseña</Label>
          <Input value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Notas</Label>
          <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-2">
          {initial ? (
            <Button
              type="button"
              variant="delete"
              onClick={() => {
                if (confirm("¿Eliminar este acceso?")) void onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={guardar}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function AccesoRow({ label, value, secret, isLink, shown, onToggleShow }: { label: string; value?: string; secret?: boolean; isLink?: boolean; shown?: boolean; onToggleShow?: () => void }) {
  if (!value) return null;
  const v = value; // TS no propaga el narrowing de arriba hacia la closure de abajo

  function copiar() {
    navigator.clipboard?.writeText(v).then(
      () => toast.success("Copiado."),
      () => {}
    );
  }

  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      {isLink ? (
        <a href={/^https?:\/\//i.test(value) ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-1 truncate text-primary hover:underline">
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{value}</span>
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{secret && !shown ? "••••••••" : value}</span>
      )}
      {secret && onToggleShow && (
        <button type="button" title={shown ? "Ocultar" : "Mostrar"} onClick={onToggleShow} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
          {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      {!isLink && (
        <button type="button" title="Copiar" onClick={copiar} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function AccesosClient() {
  const [accKey, setAccKey] = useState<CryptoKey | null>(null);
  const [raw, setRaw] = useState<AccesoRaw[] | null>(null);
  const [items, setItems] = useState<AccesoItem[] | null>(null);
  const [filtro, setFiltro] = useState("");
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AccesoItem | null>(null);
  const { quienSos, elegir } = useQuienSos();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(dbProyectos, "accesos"),
      (snap) => setRaw(snap.docs.map((d) => d.data() as AccesoRaw)),
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con la base de Accesos.");
      }
    );
    return () => unsub();
  }, []);

  // Descifra todo cuando hay clave y cuando cambian los datos crudos —
  // igual que accDecryptAll del original (con cache simple por versión de
  // `raw` en vez de por doc individual, alcanza para el volumen real).
  useEffect(() => {
    if (!accKey || !raw) {
      setItems(null);
      return;
    }
    let activo = true;
    (async () => {
      const out: AccesoItem[] = [];
      for (const d of raw) {
        try {
          const datos = await accesoDescifrar(accKey, d.iv, d.ct);
          out.push({ ...datos, id: d.id });
        } catch {
          out.push({ nombre: "(no se pudo leer)", id: d.id, _err: true });
        }
      }
      out.sort((a, b) => (a.cat ?? "").localeCompare(b.cat ?? "") || (a.nombre ?? "").localeCompare(b.nombre ?? ""));
      if (activo) setItems(out);
    })();
    return () => {
      activo = false;
    };
  }, [accKey, raw]);

  // Se vuelve a bloquear si cambia "quién sos" — mismo criterio que el
  // original ("se vuelve a bloquear ... al cambiar de usuario").
  useEffect(() => {
    setAccKey(null);
    setShown({});
  }, [quienSos]);

  const filtrados = useMemo(() => {
    if (!items) return [];
    const f = filtro.trim().toLowerCase();
    return items.filter((it) => matchFiltro(it, f));
  }, [items, filtro]);

  async function desbloquear(pin: string) {
    const key = await accUnlock(pin);
    setAccKey(key);
    if (quienSos) logActivity("entro a Accesos", "Accesos", quienSos);
  }

  function bloquear() {
    setAccKey(null);
    setShown({});
  }

  async function guardarAcceso(datos: AccesoDatos) {
    if (!accKey || !quienSos) return;
    try {
      const enc = await accesoCifrar(accKey, datos);
      const id = editTarget?.id ?? doc(collection(dbProyectos, "accesos")).id;
      await setDoc(doc(dbProyectos, "accesos", id), { id, iv: enc.iv, ct: enc.ct, ts: Date.now(), by: quienSos });
      logActivity(`${editTarget ? "edito" : "agrego"} un acceso: ${datos.nombre}`, "Accesos", quienSos);
      toast.success(editTarget ? "Acceso actualizado." : "Acceso agregado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  async function borrarAcceso() {
    if (!editTarget || !quienSos) return;
    try {
      await deleteDoc(doc(dbProyectos, "accesos", editTarget.id));
      logActivity("elimino un acceso", "Accesos", quienSos);
      setModalOpen(false);
      toast.success("Acceso eliminado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  if (quienSos === undefined) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!quienSos) {
    return <QuienSos onElegir={elegir} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <KeyRound className="h-5 w-5 text-primary" /> Accesos
        </h1>
        {accKey && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-56 pl-9" placeholder="Buscar..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            </div>
            <Button
              onClick={() => {
                setEditTarget(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nuevo acceso
            </Button>
            <Button variant="outline" onClick={bloquear}>
              <Lock className="h-4 w-4" /> Bloquear
            </Button>
          </div>
        )}
      </div>

      {!accKey ? (
        <PinLock onUnlock={desbloquear} />
      ) : items === null ? (
        <p className="text-sm text-muted-foreground">Descifrando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">{filtro ? "No hay accesos que coincidan con la búsqueda." : 'Todavía no hay accesos cargados. Usá "Nuevo acceso".'}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((it) => (
            <div key={it.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{it.nombre || "Sin nombre"}</p>
                  {it.cat && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{it.cat}</span>}
                </div>
                {!it._err && (
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => {
                      setEditTarget(it);
                      setModalOpen(true);
                    }}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!it._err && (
                <>
                  <AccesoRow label="Link" value={it.link} isLink />
                  <AccesoRow label="Usuario" value={it.usuario} />
                  <AccesoRow label="Contraseña" value={it.clave} secret shown={shown[it.id]} onToggleShow={() => setShown((p) => ({ ...p, [it.id]: !p[it.id] }))} />
                  {it.notas && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{it.notas}</p>}
                </>
              )}
              {it._err && <p className="text-xs text-destructive">No se pudo descifrar esta entrada.</p>}
            </div>
          ))}
        </div>
      )}

      <AccesoModal open={modalOpen} initial={editTarget} onClose={() => setModalOpen(false)} onSave={guardarAcceso} onDelete={borrarAcceso} />
    </div>
  );
}
