"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Mail, Paperclip, FileText, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  createLicitacion,
  updateLicitacion,
  deleteLicitacion,
  sendLicitacionesDigestNow,
} from "./actions";

export type LicitacionEstado = "INSCRIPTO" | "NO_INSCRIPTO" | "EN_TRAMITE";

export type LicitacionDocumento = {
  nombre: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAtISO?: string;
};

export type LicitacionItemRow = {
  numero: string;
  estado: LicitacionEstado;
  // Documento ya guardado en base (viene del server). Se reenvía tal cual
  // al guardar para no perderlo, salvo que el usuario lo reemplace o lo
  // quite en esta misma edición.
  documento?: LicitacionDocumento | null;
  // Archivo recién elegido en esta sesión de edición, todavía no subido —
  // viaja con el resto del formulario al guardar (mismo criterio que la
  // foto de Empleados: no hace falta que la licitación ya exista en base).
  nuevoArchivo?: File | null;
};

const DOC_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_DOC_BYTES = 10 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type LicitacionItem = {
  id: string;
  entidad: string;
  estado: LicitacionEstado;
  numeroProveedor?: string;
  licitaciones: LicitacionItemRow[];
  observaciones?: string;
};

const ESTADO_LABEL: Record<LicitacionEstado, string> = {
  INSCRIPTO: "Inscripto",
  NO_INSCRIPTO: "No inscripto",
  EN_TRAMITE: "En trámite",
};

const ESTADO_BADGE: Record<LicitacionEstado, "success" | "warning" | "destructive"> = {
  INSCRIPTO: "success",
  EN_TRAMITE: "warning",
  NO_INSCRIPTO: "destructive",
};

function emptyItemRow(): LicitacionItemRow {
  return { numero: "", estado: "EN_TRAMITE", documento: undefined, nuevoArchivo: null };
}

// ---------- formulario de alta/edición de una entidad ----------

function LicitacionForm({
  initial,
  onSubmit,
  onDone,
  saving,
}: {
  initial?: LicitacionItem;
  onSubmit: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
  saving: boolean;
}) {
  const router = useRouter();
  const [entidad, setEntidad] = useState(initial?.entidad ?? "");
  const [estado, setEstado] = useState<LicitacionEstado>(initial?.estado ?? "NO_INSCRIPTO");
  const [numeroProveedor, setNumeroProveedor] = useState(initial?.numeroProveedor ?? "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [items, setItems] = useState<LicitacionItemRow[]>(
    initial?.licitaciones && initial.licitaciones.length > 0 ? initial.licitaciones : [emptyItemRow()]
  );
  const [localSaving, setLocalSaving] = useState(false);

  function updateItem(index: number, patch: Partial<LicitacionItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItemRow()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDocumentoFile(index: number, file: File | undefined) {
    if (!file) return;
    if (!DOC_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Solo se aceptan archivos PDF, JPG o PNG.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      toast.error("El archivo pesa más de 10MB.");
      return;
    }
    updateItem(index, { nuevoArchivo: file });
  }

  function quitarDocumento(index: number) {
    updateItem(index, { documento: null, nuevoArchivo: null });
  }

  function cancelarNuevoArchivo(index: number) {
    updateItem(index, { nuevoArchivo: null });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 2026-11-26, Ariel: una fila sin N° de licitación se descarta entera
    // al guardar (ver comentario server-side) — si tiene un documento
    // adjunto, ese documento se iba con ella sin ningún aviso (pasó en
    // producción con EPEC: subió el archivo, grabó, y al volver a entrar
    // ya no estaba — nunca se había llegado a escribir en el servidor).
    // Frenamos acá antes de mandar el formulario.
    const filaConDocumentoSinNumero = items.find(
      (row) => row.numero.trim().length === 0 && (row.nuevoArchivo || row.documento)
    );
    if (filaConDocumentoSinNumero) {
      toast.error(
        "Hay un documento adjunto en una fila sin N° de licitación. Completá el número o quitá el documento antes de guardar."
      );
      return;
    }

    const fd = new FormData();
    fd.set("entidad", entidad);
    fd.set("estado", estado);
    fd.set("numeroProveedor", numeroProveedor);
    fd.set("observaciones", observaciones);
    // Filas sin número cargado se descartan server-side — acá se mandan
    // todas tal cual para no perder la fila que el usuario está
    // completando a medias si algo falla antes.
    for (const row of items) {
      fd.append("itemNumero", row.numero);
      fd.append("itemEstado", row.estado);
      fd.append("itemDocumentoFile", row.nuevoArchivo ?? "");
      fd.append("itemDocumentoExisting", row.nuevoArchivo ? "" : row.documento ? JSON.stringify(row.documento) : "");
    }

    setLocalSaving(true);
    const result = await onSubmit(fd);
    setLocalSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success(initial ? "Entidad actualizada." : "Entidad creada.");
    router.refresh();
    onDone();
  }

  const busy = saving || localSaving;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="entidad">Entidad</Label>
          <Input
            id="entidad"
            value={entidad}
            onChange={(e) => setEntidad(e.target.value)}
            required
            placeholder="Ej: Registro de Proveedores del Estado"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select
            id="estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as LicitacionEstado)}
          >
            <option value="INSCRIPTO">Inscripto</option>
            <option value="NO_INSCRIPTO">No inscripto</option>
            <option value="EN_TRAMITE">En trámite</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numeroProveedor">N° de Proveedor</Label>
          <Input
            id="numeroProveedor"
            value={numeroProveedor}
            onChange={(e) => setNumeroProveedor(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Licitaciones de esta entidad</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Agregar licitación
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                <Input
                  placeholder="N° de licitación"
                  value={row.numero}
                  onChange={(e) => updateItem(i, { numero: e.target.value })}
                  className="sm:col-span-2"
                />
                <Select
                  value={row.estado}
                  onChange={(e) => updateItem(i, { estado: e.target.value as LicitacionEstado })}
                  className="sm:col-span-2"
                >
                  <option value="INSCRIPTO">Inscripto</option>
                  <option value="NO_INSCRIPTO">No inscripto</option>
                  <option value="EN_TRAMITE">En trámite</option>
                </Select>
                <Button
                  type="button"
                  variant="delete"
                  size="sm"
                  className="sm:col-span-1"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {row.nuevoArchivo ? (
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{row.nuevoArchivo.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      ({formatBytes(row.nuevoArchivo.size)}) — se sube al guardar
                    </span>
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => cancelarNuevoArchivo(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : row.documento ? (
                <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs">
                  <a
                    href={row.documento.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-1.5 truncate hover:underline"
                  >
                    {row.documento.mimeType === "application/pdf" ? (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{row.documento.nombre}</span>
                    <span className="shrink-0 text-muted-foreground">({formatBytes(row.documento.size)})</span>
                  </a>
                  <div className="flex shrink-0 gap-1">
                    <label className="cursor-pointer">
                      <span className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2 text-xs hover:bg-muted">
                        Reemplazar
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => handleDocumentoFile(i, e.target.files?.[0])}
                      />
                    </label>
                    <Button type="button" size="sm" variant="delete" onClick={() => quitarDocumento(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-3.5 w-3.5" />
                  Adjuntar documento (PDF, JPG o PNG — máx. 10MB)
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => handleDocumentoFile(i, e.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Una fila sin número cargado no se guarda — dejá solo las que correspondan.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea
          id="observaciones"
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando..." : initial ? "Guardar cambios" : "Crear entidad"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function LicitacionesClient({
  items,
  role,
}: {
  items: LicitacionItem[];
  role: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LicitacionItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LicitacionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);

  async function performDelete(item: LicitacionItem) {
    setDeleting(true);
    const result = await deleteLicitacion(item.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Entidad borrada.");
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleSendNow() {
    setSendingNow(true);
    const result = await sendLicitacionesDigestNow();
    setSendingNow(false);
    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success(result.message ?? "Listo.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {role === "OWNER" && (
          <Button type="button" variant="outline" disabled={sendingNow} onClick={handleSendNow}>
            <Mail className="h-4 w-4" />
            {sendingNow ? "Enviando..." : "Enviar resumen ahora (prueba)"}
          </Button>
        )}
        <Button type="button" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva entidad
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Todavía no cargaste ninguna entidad.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>N° Proveedor</TableHead>
              <TableHead>Licitaciones</TableHead>
              <TableHead>Observaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.entidad}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_BADGE[item.estado]}>{ESTADO_LABEL[item.estado]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.numeroProveedor || "—"}</TableCell>
                <TableCell>
                  {item.licitaciones.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {item.licitaciones.map((lic, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <span className="font-medium">{lic.numero}</span>
                          <Badge variant={ESTADO_BADGE[lic.estado]}>{ESTADO_LABEL[lic.estado]}</Badge>
                          {lic.documento && (
                            <a
                              href={lic.documento.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={lic.documento.nombre}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Paperclip className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {item.observaciones || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditTarget(item)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="delete"
                      size="sm"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Nueva entidad"
        className="max-w-2xl"
      >
        {formOpen && (
          <LicitacionForm
            onSubmit={createLicitacion}
            onDone={() => setFormOpen(false)}
            saving={false}
          />
        )}
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar entidad"
        className="max-w-2xl"
      >
        {editTarget && (
          <LicitacionForm
            initial={editTarget}
            onSubmit={(fd) => updateLicitacion(editTarget.id, fd)}
            onDone={() => setEditTarget(null)}
            saving={false}
          />
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar entidad"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{deleteTarget.entidad}</span> y todas
              sus licitaciones cargadas? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => performDelete(deleteTarget)}
              >
                {deleting ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
