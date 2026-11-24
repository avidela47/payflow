"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Search, Download, Trash2 } from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { TEAM, PROYECTO_COLORS } from "@/lib/proyectos-team";
import { notificarProyectoNuevo, notificarEstadoFinal } from "@/lib/proyectos-notify";
import { useQuienSos, QuienSos } from "./quien-sos";
import {
  PROYECTO_PRIORIDADES,
  prioridadLabel,
  prioridadBadgeVariant,
  proyectoEstadoLabel,
  proyectoEstadoBadgeVariant,
  type ProyectoEstado,
  type ProyectoPrioridad,
} from "@/lib/proyectos-estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export type ClienteOption = { id: string; nombre: string };

// Forma MÍNIMA que PayFlow necesita de un documento de "projects" en
// Firestore. A propósito es un tipo abierto ([key: string]: unknown): la
// colección es compartida con otras pestañas del tablero original (Gestión
// de Proyectos, Arquitectura) y tiene más campos (obra, aspectos, computos,
// carpeta, necesario, arqProjectId, notasPeg, checklist, contactosObra...)
// que PayFlow todavía no edita. Tipar solo lo que usamos, y escribir SIEMPRE
// con { merge: true }, evita que este módulo pise o borre datos de esas
// otras pantallas al guardar.
export type ProyectoDoc = {
  id: string;
  name: string;
  color: string;
  members: string[];
  start?: string;
  end?: string;
  notes?: string;
  section: string;
  priority: ProyectoPrioridad;
  status: ProyectoEstado;
  fechaVenta?: string;
  clienteId?: string;
  clienteNombre?: string;
  [key: string]: unknown;
};

function ProyectoForm({
  clientes,
  quienSos,
  onDone,
}: {
  clientes: ClienteOption[];
  quienSos: string;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [prioridad, setPrioridad] = useState<ProyectoPrioridad>("media");
  const [color, setColor] = useState(PROYECTO_COLORS[0]);
  const [miembros, setMiembros] = useState<string[]>([]);

  function toggleMiembro(id: string) {
    setMiembros((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("Falta el nombre del proyecto.");
      return;
    }
    setSaving(true);
    try {
      const cliente = clientes.find((c) => c.id === clienteId);
      const ref = doc(collection(dbProyectos, "projects"));
      const data: ProyectoDoc = {
        id: ref.id,
        name: nombre.trim(),
        color,
        members: miembros,
        start: inicio || undefined,
        end: fin || undefined,
        section: "pipeline",
        priority: prioridad,
        status: "activo",
        clienteId: cliente?.id,
        clienteNombre: cliente?.nombre,
      };
      await setDoc(ref, data);
      notificarProyectoNuevo(data, quienSos);
      toast.success("Proyecto creado.");
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
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cliente">Cliente (opcional)</Label>
        <Select id="cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Sin cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inicio">Fecha inicio</Label>
          <Input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fin">Fecha fin</Label>
          <Input id="fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select id="prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value as ProyectoPrioridad)}>
            {PROYECTO_PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {prioridadLabel(p)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="color">Color</Label>
          <Input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Miembros</Label>
        <div className="flex flex-wrap gap-1.5">
          {TEAM.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMiembro(m.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                miembros.includes(m.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando..." : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}

function miembrosNombres(ids: string[]): string {
  if (!ids || ids.length === 0) return "—";
  return ids
    .map((id) => TEAM.find((m) => m.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

async function cambiarEstado(p: ProyectoDoc, estado: ProyectoEstado, quienSos: string) {
  const ref = doc(dbProyectos, "projects", p.id);
  const estadoAnterior = p.status;
  let fechaVenta = p.fechaVenta;
  if (estado === "vendido") {
    fechaVenta = p.fechaVenta ?? new Date().toISOString();
    await setDoc(ref, { status: "vendido", fechaVenta }, { merge: true });
  } else {
    await setDoc(ref, { status: estado }, { merge: true });
  }
  // Igual que el original: solo se notifica cuando el estado REALMENTE
  // cambia a vendido/finalizado, no en cada edición mientras ya está en ese
  // estado.
  if (estado !== estadoAnterior && (estado === "vendido" || estado === "finalizado")) {
    notificarEstadoFinal({ ...p, fechaVenta }, estado, quienSos);
  }
}

async function borrarProyecto(id: string) {
  // Se borran también sus tareas — evita dejar huérfanas en la colección
  // "tasks" (la app original no deja claro si hace este cascade; se opta
  // por el comportamiento más seguro).
  const tareasSnap = await getDocs(query(collection(dbProyectos, "tasks"), where("projId", "==", id)));
  await Promise.all(tareasSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(dbProyectos, "projects", id));
}

function exportarExcel(filename: string, rows: (string | number)[][]) {
  import("xlsx").then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proyectos");
    XLSX.writeFile(wb, filename);
  });
}

function ProyectosTabla({
  items,
  quienSos,
  onDelete,
}: {
  items: ProyectoDoc[];
  quienSos: string;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Sin proyectos.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Proyecto</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Equipo</TableHead>
          <TableHead>Fechas</TableHead>
          <TableHead>Prioridad</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <Link href={`/pipeline/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
              </div>
            </TableCell>
            <TableCell>{p.clienteNombre || "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{miembrosNombres(p.members)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {p.start ? new Date(p.start).toLocaleDateString("es-AR") : "—"}
              {" – "}
              {p.end ? new Date(p.end).toLocaleDateString("es-AR") : "—"}
            </TableCell>
            <TableCell>
              <Badge variant={prioridadBadgeVariant(p.priority)}>{prioridadLabel(p.priority)}</Badge>
            </TableCell>
            <TableCell>
              <Select
                value={p.status}
                onChange={(e) =>
                  cambiarEstado(p, e.target.value as ProyectoEstado, quienSos).catch(() =>
                    toast.error("No se pudo cambiar el estado.")
                  )
                }
                className="h-8 w-32 text-xs"
              >
                <option value="activo">Activo</option>
                <option value="vendido">Vendido</option>
                <option value="finalizado">Finalizado</option>
              </Select>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/pipeline/${p.id}`}>Ver</Link>
                </Button>
                <Button
                  size="sm"
                  variant="delete"
                  className="h-8 w-8 p-0"
                  title="Borrar"
                  onClick={() => {
                    if (confirm(`¿Borrar "${p.name}" y sus tareas? No se puede deshacer.`)) {
                      onDelete(p.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PipelineClient({ clientes }: { clientes: ClienteOption[] }) {
  const [proyectos, setProyectos] = useState<ProyectoDoc[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [creandoOpen, setCreandoOpen] = useState(false);
  const { quienSos, elegir } = useQuienSos();

  useEffect(() => {
    const q = query(collection(dbProyectos, "projects"), where("section", "==", "pipeline"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProyectos(snap.docs.map((d) => d.data() as ProyectoDoc));
      },
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con la base de Proyectos.");
      }
    );
    return () => unsub();
  }, []);

  const filtrados = useMemo(() => {
    if (!proyectos) return [];
    const term = busqueda.trim().toLowerCase();
    return proyectos.filter(
      (p) => !term || p.name.toLowerCase().includes(term) || (p.clienteNombre ?? "").toLowerCase().includes(term)
    );
  }, [proyectos, busqueda]);

  const activos = filtrados.filter((p) => p.status === "activo");
  const finalizados = filtrados.filter((p) => p.status === "finalizado");
  const vendidos = filtrados.filter((p) => p.status === "vendido");

  async function handleDelete(id: string) {
    try {
      await borrarProyecto(id);
      toast.success("Proyecto borrado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  if (!quienSos) {
    return <QuienSos onElegir={elegir} />;
  }

  if (proyectos === null) {
    return <p className="text-sm text-muted-foreground">Cargando proyectos…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cliente..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportarExcel(
                "proyectos-detalle.xlsx",
                [
                  ["Proyecto", "Cliente", "Equipo", "Inicio", "Fin", "Prioridad", "Estado"],
                  ...activos.map((p) => [
                    p.name,
                    p.clienteNombre || "",
                    miembrosNombres(p.members),
                    p.start || "",
                    p.end || "",
                    prioridadLabel(p.priority),
                    proyectoEstadoLabel(p.status),
                  ]),
                ]
              )
            }
          >
            <Download className="h-4 w-4" />
            Exportar detalle a Excel
          </Button>
          <Button onClick={() => setCreandoOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </Button>
        </div>
      </div>

      <ProyectosTabla items={activos} quienSos={quienSos} onDelete={handleDelete} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Finalizados</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportarExcel(
                "proyectos-finalizados.xlsx",
                [
                  ["Proyecto", "Cliente", "Equipo"],
                  ...finalizados.map((p) => [p.name, p.clienteNombre || "", miembrosNombres(p.members)]),
                ]
              )
            }
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
        <ProyectosTabla items={finalizados} quienSos={quienSos} onDelete={handleDelete} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Vendidos</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportarExcel(
                "proyectos-vendidos.xlsx",
                [
                  ["Proyecto", "Cliente", "Fecha de venta"],
                  ...vendidos.map((p) => [
                    p.name,
                    p.clienteNombre || "",
                    p.fechaVenta ? new Date(p.fechaVenta).toLocaleDateString("es-AR") : "",
                  ]),
                ]
              )
            }
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
        <ProyectosTabla items={vendidos} quienSos={quienSos} onDelete={handleDelete} />
      </div>

      <Dialog open={creandoOpen} onOpenChange={setCreandoOpen} title="Nuevo proyecto" className="max-w-lg">
        <ProyectoForm clientes={clientes} quienSos={quienSos} onDone={() => setCreandoOpen(false)} />
      </Dialog>
    </div>
  );
}
