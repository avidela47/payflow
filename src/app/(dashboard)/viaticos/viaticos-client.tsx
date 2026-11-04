"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { createViatico, updateViatico, deleteViatico, type ViaticoFormInput } from "./actions";
import type { ViaticoHonorarioType } from "@/models/Viatico";

export type EmployeeOption = { id: string; nombre: string; apellido: string; area?: string };

export type ViaticoEmpleadoItem = {
  employeeId: string;
  // Nombre resuelto server-side (ver page.tsx) — así el detalle muestra el
  // nombre correcto incluso si el empleado ya no está activo y por eso no
  // aparece en la lista `employees` que recibe este componente. Opcional
  // porque una fila nueva del formulario (todavía sin empleado elegido)
  // no lo tiene.
  employeeName?: string;
  honorarioType: ViaticoHonorarioType;
  monto: number;
  dias?: number;
};

export type ViaticoExtraItem = { descripcion: string; monto: number };
export type ViaticoMaterialItem = { descripcion: string; cantidad?: number; monto: number };

export type ViaticoItem = {
  id: string;
  nombre: string;
  paidBy?: string;
  fechaISO: string;
  empleados: ViaticoEmpleadoItem[];
  hospedajeLugar?: string;
  hospedajeCheckIn?: string;
  hospedajeCheckOut?: string;
  hospedajeCostoPorDia?: number;
  hospedajeCantidadDias?: number;
  hospedajePaidBy?: string;
  combustibleMonto?: number;
  combustiblePaidBy?: string;
  extras: ViaticoExtraItem[];
  materiales: ViaticoMaterialItem[];
  seguroCompania?: string;
  seguroCobertura?: string;
  seguroCantidadDias?: number;
  seguroCosto?: number;
  montoTopeDiario?: number;
  excedente: number;
  notes?: string;
};

type EmpleadoRow = ViaticoEmpleadoItem & { _key: number };
type ExtraRow = ViaticoExtraItem & { _key: number };
type MaterialRow = ViaticoMaterialItem & { _key: number };

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return keySeq;
}

function emptyEmpleadoRow(): EmpleadoRow {
  return { _key: nextKey(), employeeId: "", honorarioType: "DIA", monto: 0, dias: 1 };
}
function emptyExtraRow(): ExtraRow {
  return { _key: nextKey(), descripcion: "", monto: 0 };
}
function emptyMaterialRow(): MaterialRow {
  return { _key: nextKey(), descripcion: "", cantidad: undefined, monto: 0 };
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

// Total "pagado" del viático: suma de honorarios de empleados (TRABAJO:
// monto fijo; DIA: monto x días) + hospedaje + combustible + extras +
// materiales + seguro. El excedente NO se suma aparte: ya está adentro
// del monto de honorario del empleado que lo generó, es solo una línea
// informativa para contabilidad/impuestos.
function calcularTotal(v: {
  empleados: ViaticoEmpleadoItem[];
  hospedajeCostoPorDia?: number;
  hospedajeCantidadDias?: number;
  combustibleMonto?: number;
  extras: ViaticoExtraItem[];
  materiales: ViaticoMaterialItem[];
  seguroCosto?: number;
}): number {
  const empleadosTotal = v.empleados.reduce(
    (sum, e) => sum + (e.honorarioType === "DIA" ? e.monto * (e.dias ?? 1) : e.monto),
    0
  );
  const hospedajeTotal = (v.hospedajeCostoPorDia ?? 0) * (v.hospedajeCantidadDias ?? 0);
  const extrasTotal = v.extras.reduce((sum, x) => sum + x.monto, 0);
  const materialesTotal = v.materiales.reduce((sum, x) => sum + x.monto, 0);
  return (
    empleadosTotal +
    hospedajeTotal +
    (v.combustibleMonto ?? 0) +
    extrasTotal +
    materialesTotal +
    (v.seguroCosto ?? 0)
  );
}

export function ViaticosClient({
  employees,
  viaticos,
}: {
  employees: EmployeeOption[];
  viaticos: ViaticoItem[];
}) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ViaticoItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<ViaticoItem | null>(null);

  // Campos simples
  const [nombre, setNombre] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [montoTopeDiario, setMontoTopeDiario] = useState("");
  const [notes, setNotes] = useState("");

  // Hospedaje
  const [hospedajeLugar, setHospedajeLugar] = useState("");
  const [hospedajeCheckIn, setHospedajeCheckIn] = useState("");
  const [hospedajeCheckOut, setHospedajeCheckOut] = useState("");
  const [hospedajeCostoPorDia, setHospedajeCostoPorDia] = useState("");
  const [hospedajeCantidadDias, setHospedajeCantidadDias] = useState("");
  const [hospedajePaidBy, setHospedajePaidBy] = useState("");

  // Combustible (EdenRed)
  const [combustibleMonto, setCombustibleMonto] = useState("");
  const [combustiblePaidBy, setCombustiblePaidBy] = useState("");

  // Seguro
  const [seguroCompania, setSeguroCompania] = useState("");
  const [seguroCobertura, setSeguroCobertura] = useState("");
  const [seguroCantidadDias, setSeguroCantidadDias] = useState("");
  const [seguroCosto, setSeguroCosto] = useState("");

  // Listas dinámicas
  const [empleadosRows, setEmpleadosRows] = useState<EmpleadoRow[]>([emptyEmpleadoRow()]);
  const [extrasRows, setExtrasRows] = useState<ExtraRow[]>([]);
  const [materialesRows, setMaterialesRows] = useState<MaterialRow[]>([]);

  function resetForm() {
    setNombre("");
    setPaidBy("");
    setFecha(todayISO());
    setMontoTopeDiario("");
    setNotes("");
    setHospedajeLugar("");
    setHospedajeCheckIn("");
    setHospedajeCheckOut("");
    setHospedajeCostoPorDia("");
    setHospedajeCantidadDias("");
    setHospedajePaidBy("");
    setCombustibleMonto("");
    setCombustiblePaidBy("");
    setSeguroCompania("");
    setSeguroCobertura("");
    setSeguroCantidadDias("");
    setSeguroCosto("");
    setEmpleadosRows([emptyEmpleadoRow()]);
    setExtrasRows([]);
    setMaterialesRows([]);
  }

  function openCreate() {
    resetForm();
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(v: ViaticoItem) {
    setNombre(v.nombre);
    setPaidBy(v.paidBy ?? "");
    setFecha(v.fechaISO);
    setMontoTopeDiario(v.montoTopeDiario != null ? String(v.montoTopeDiario) : "");
    setNotes(v.notes ?? "");
    setHospedajeLugar(v.hospedajeLugar ?? "");
    setHospedajeCheckIn(v.hospedajeCheckIn ?? "");
    setHospedajeCheckOut(v.hospedajeCheckOut ?? "");
    setHospedajeCostoPorDia(v.hospedajeCostoPorDia != null ? String(v.hospedajeCostoPorDia) : "");
    setHospedajeCantidadDias(v.hospedajeCantidadDias != null ? String(v.hospedajeCantidadDias) : "");
    setHospedajePaidBy(v.hospedajePaidBy ?? "");
    setCombustibleMonto(v.combustibleMonto != null ? String(v.combustibleMonto) : "");
    setCombustiblePaidBy(v.combustiblePaidBy ?? "");
    setSeguroCompania(v.seguroCompania ?? "");
    setSeguroCobertura(v.seguroCobertura ?? "");
    setSeguroCantidadDias(v.seguroCantidadDias != null ? String(v.seguroCantidadDias) : "");
    setSeguroCosto(v.seguroCosto != null ? String(v.seguroCosto) : "");
    setEmpleadosRows(
      v.empleados.length > 0
        ? v.empleados.map((e) => ({ ...e, _key: nextKey() }))
        : [emptyEmpleadoRow()]
    );
    setExtrasRows(v.extras.map((e) => ({ ...e, _key: nextKey() })));
    setMaterialesRows(v.materiales.map((m) => ({ ...m, _key: nextKey() })));
    setEditingId(v.id);
    setFormOpen(true);
  }

  const previewTotal = useMemo(
    () =>
      calcularTotal({
        empleados: empleadosRows,
        hospedajeCostoPorDia: Number(hospedajeCostoPorDia) || undefined,
        hospedajeCantidadDias: Number(hospedajeCantidadDias) || undefined,
        combustibleMonto: Number(combustibleMonto) || undefined,
        extras: extrasRows,
        materiales: materialesRows,
        seguroCosto: Number(seguroCosto) || undefined,
      }),
    [empleadosRows, hospedajeCostoPorDia, hospedajeCantidadDias, combustibleMonto, extrasRows, materialesRows, seguroCosto]
  );

  const previewExcedente = useMemo(() => {
    const tope = Number(montoTopeDiario);
    if (!tope) return 0;
    return empleadosRows.reduce((sum, e) => {
      if (e.honorarioType !== "DIA") return sum;
      const diff = e.monto - tope;
      if (diff <= 0) return sum;
      return sum + diff * (e.dias ?? 1);
    }, 0);
  }, [empleadosRows, montoTopeDiario]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const input: ViaticoFormInput = {
      nombre,
      paidBy: paidBy || undefined,
      fecha,
      empleados: empleadosRows
        .filter((r) => r.employeeId)
        .map((r) => ({
          employeeId: r.employeeId,
          honorarioType: r.honorarioType,
          monto: r.monto,
          dias: r.honorarioType === "DIA" ? r.dias || 1 : undefined,
        })),
      hospedajeLugar: hospedajeLugar || undefined,
      hospedajeCheckIn: hospedajeCheckIn || undefined,
      hospedajeCheckOut: hospedajeCheckOut || undefined,
      hospedajeCostoPorDia: hospedajeCostoPorDia ? Number(hospedajeCostoPorDia) : undefined,
      hospedajeCantidadDias: hospedajeCantidadDias ? Number(hospedajeCantidadDias) : undefined,
      hospedajePaidBy: hospedajePaidBy || undefined,
      combustibleMonto: combustibleMonto ? Number(combustibleMonto) : undefined,
      combustiblePaidBy: combustiblePaidBy || undefined,
      extras: extrasRows.filter((r) => r.descripcion).map((r) => ({ descripcion: r.descripcion, monto: r.monto })),
      materiales: materialesRows
        .filter((r) => r.descripcion)
        .map((r) => ({ descripcion: r.descripcion, cantidad: r.cantidad, monto: r.monto })),
      seguroCompania: seguroCompania || undefined,
      seguroCobertura: seguroCobertura || undefined,
      seguroCantidadDias: seguroCantidadDias ? Number(seguroCantidadDias) : undefined,
      seguroCosto: seguroCosto ? Number(seguroCosto) : undefined,
      montoTopeDiario: montoTopeDiario ? Number(montoTopeDiario) : undefined,
      notes: notes || undefined,
    };

    setSaving(true);
    const result = editingId ? await updateViatico(editingId, input) : await createViatico(input);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(editingId ? "Viático actualizado." : "Viático guardado.");
    setFormOpen(false);
    resetForm();
    setEditingId(null);
    router.refresh();
  }

  async function performDelete(v: ViaticoItem) {
    setDeletingId(v.id);
    const result = await deleteViatico(v.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Viático borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {viaticos.length === 0 ? "Todavía no hay viáticos cargados." : `${viaticos.length} viático(s) cargado(s).`}
        </p>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo viático
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead>Viaje</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Paga</TableHead>
            <TableHead>Empleados</TableHead>
            <TableHead>Total estimado</TableHead>
            <TableHead>Excedente</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {viaticos.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Todavía no hay viáticos cargados.
              </TableCell>
            </TableRow>
          )}
          {viaticos.map((v) => {
            const total = calcularTotal(v);
            return (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  <button className="hover:underline" onClick={() => setDetailTarget(v)}>
                    {v.nombre}
                  </button>
                </TableCell>
                <TableCell>{formatDate(v.fechaISO)}</TableCell>
                <TableCell>{v.paidBy ?? "—"}</TableCell>
                <TableCell>{v.empleados.length}</TableCell>
                <TableCell>{formatCurrency(total)}</TableCell>
                <TableCell>
                  {v.excedente > 0 ? (
                    <Badge variant="warning">{formatCurrency(v.excedente)}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:bg-primary/10"
                      onClick={() => openEdit(v)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmTarget(v)}
                    >
                      Borrar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Alta / edición */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(null);
        }}
        title={editingId ? "Editar viático" : "Nuevo viático"}
        className="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="nombre">Nombre del viaje</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Morón"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paidBy">Quién paga (empleador)</Label>
              <Input
                id="paidBy"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder="ITELSA / Rubén..."
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="montoTopeDiario">Tope diario de viático (por empleado/día)</Label>
              <Input
                id="montoTopeDiario"
                type="number"
                step="0.01"
                min="0"
                value={montoTopeDiario}
                onChange={(e) => setMontoTopeDiario(e.target.value)}
                placeholder="Si se supera, se calcula el excedente"
              />
            </div>
          </div>

          {/* Empleados */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Empleados en el viaje</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEmpleadosRows((rows) => [...rows, emptyEmpleadoRow()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            {empleadosRows.map((row, idx) => (
              <div key={row._key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] sm:items-end">
                <div className="flex flex-col gap-1.5">
                  {idx === 0 && <Label>Empleado</Label>}
                  <Select
                    value={row.employeeId}
                    onChange={(e) =>
                      setEmpleadosRows((rows) =>
                        rows.map((r) => (r._key === row._key ? { ...r, employeeId: e.target.value } : r))
                      )
                    }
                  >
                    <option value="">Elegir...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre} {emp.apellido}
                        {emp.area ? ` (${emp.area})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  {idx === 0 && <Label>Tipo de pago</Label>}
                  <Select
                    value={row.honorarioType}
                    onChange={(e) =>
                      setEmpleadosRows((rows) =>
                        rows.map((r) =>
                          r._key === row._key
                            ? { ...r, honorarioType: e.target.value as ViaticoHonorarioType }
                            : r
                        )
                      )
                    }
                  >
                    <option value="DIA">Por día</option>
                    <option value="TRABAJO">Por trabajo (monto fijo)</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  {idx === 0 && <Label>{row.honorarioType === "DIA" ? "Monto por día" : "Monto total"}</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.monto || ""}
                    onChange={(e) =>
                      setEmpleadosRows((rows) =>
                        rows.map((r) => (r._key === row._key ? { ...r, monto: Number(e.target.value) } : r))
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  {idx === 0 && <Label>Días</Label>}
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    disabled={row.honorarioType !== "DIA"}
                    value={row.dias ?? ""}
                    onChange={(e) =>
                      setEmpleadosRows((rows) =>
                        rows.map((r) => (r._key === row._key ? { ...r, dias: Number(e.target.value) } : r))
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setEmpleadosRows((rows) => rows.filter((r) => r._key !== row._key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Hospedaje */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <span className="text-sm font-medium">Hospedaje</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Lugar</Label>
                <Input value={hospedajeLugar} onChange={(e) => setHospedajeLugar(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Check-in</Label>
                <Input type="date" value={hospedajeCheckIn} onChange={(e) => setHospedajeCheckIn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Check-out</Label>
                <Input type="date" value={hospedajeCheckOut} onChange={(e) => setHospedajeCheckOut(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Costo por día</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hospedajeCostoPorDia}
                  onChange={(e) => setHospedajeCostoPorDia(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cantidad de días</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={hospedajeCantidadDias}
                  onChange={(e) => setHospedajeCantidadDias(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Quién paga</Label>
                <Input
                  value={hospedajePaidBy}
                  onChange={(e) => setHospedajePaidBy(e.target.value)}
                  placeholder="ITELSA / Rubén..."
                />
              </div>
            </div>
          </div>

          {/* Combustible / EdenRed */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <span className="text-sm font-medium">Combustible (EdenRed)</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={combustibleMonto}
                  onChange={(e) => setCombustibleMonto(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Quién paga</Label>
                <Input
                  value={combustiblePaidBy}
                  onChange={(e) => setCombustiblePaidBy(e.target.value)}
                  placeholder="ITELSA / Rubén..."
                />
              </div>
            </div>
          </div>

          {/* Extras */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Extras (gastos no previstos)</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExtrasRows((rows) => [...rows, emptyExtraRow()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            {extrasRows.map((row) => (
              <div key={row._key} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto]">
                <Input
                  placeholder="Descripción"
                  value={row.descripcion}
                  onChange={(e) =>
                    setExtrasRows((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, descripcion: e.target.value } : r))
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Monto"
                  value={row.monto || ""}
                  onChange={(e) =>
                    setExtrasRows((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, monto: Number(e.target.value) } : r))
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setExtrasRows((rows) => rows.filter((r) => r._key !== row._key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Materiales */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Materiales (faltantes para terminar la obra)</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMaterialesRows((rows) => [...rows, emptyMaterialRow()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            {materialesRows.map((row) => (
              <div key={row._key} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <Input
                  placeholder="Descripción"
                  value={row.descripcion}
                  onChange={(e) =>
                    setMaterialesRows((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, descripcion: e.target.value } : r))
                    )
                  }
                />
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Cantidad"
                  value={row.cantidad ?? ""}
                  onChange={(e) =>
                    setMaterialesRows((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, cantidad: Number(e.target.value) } : r))
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Monto"
                  value={row.monto || ""}
                  onChange={(e) =>
                    setMaterialesRows((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, monto: Number(e.target.value) } : r))
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setMaterialesRows((rows) => rows.filter((r) => r._key !== row._key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Seguro */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <span className="text-sm font-medium">Seguro</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label>Compañía</Label>
                <Input value={seguroCompania} onChange={(e) => setSeguroCompania(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Qué cubre</Label>
                <Input value={seguroCobertura} onChange={(e) => setSeguroCobertura(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cantidad de días</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={seguroCantidadDias}
                  onChange={(e) => setSeguroCantidadDias(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Costo</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={seguroCosto}
                  onChange={(e) => setSeguroCosto(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              Total estimado: <span className="font-medium text-foreground">{formatCurrency(previewTotal)}</span>
              {previewExcedente > 0 && (
                <>
                  {" · "}Excedente de viáticos:{" "}
                  <span className="font-medium text-foreground">{formatCurrency(previewExcedente)}</span>
                </>
              )}
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar viático"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Detalle (solo lectura, al click en el nombre) */}
      <Dialog
        open={detailTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
        title={detailTarget ? detailTarget.nombre : undefined}
        className="max-w-lg"
      >
        {detailTarget && (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <span className="text-muted-foreground">Fecha: </span>
              {formatDate(detailTarget.fechaISO)}
            </p>
            <p>
              <span className="text-muted-foreground">Paga: </span>
              {detailTarget.paidBy ?? "—"}
            </p>
            <div>
              <span className="text-muted-foreground">Empleados:</span>
              <ul className="ml-4 list-disc">
                {detailTarget.empleados.map((e, i) => (
                  <li key={i}>
                    {e.employeeName} —{" "}
                    {e.honorarioType === "DIA"
                      ? `${formatCurrency(e.monto)}/día x ${e.dias ?? 1} día(s)`
                      : formatCurrency(e.monto)}
                  </li>
                ))}
              </ul>
            </div>
            {detailTarget.hospedajeLugar && (
              <p>
                <span className="text-muted-foreground">Hospedaje: </span>
                {detailTarget.hospedajeLugar} ({formatDate(detailTarget.hospedajeCheckIn)} —{" "}
                {formatDate(detailTarget.hospedajeCheckOut)})
              </p>
            )}
            {detailTarget.combustibleMonto ? (
              <p>
                <span className="text-muted-foreground">Combustible (EdenRed): </span>
                {formatCurrency(detailTarget.combustibleMonto)}
                {detailTarget.combustiblePaidBy ? ` — paga ${detailTarget.combustiblePaidBy}` : ""}
              </p>
            ) : null}
            {detailTarget.extras.length > 0 && (
              <div>
                <span className="text-muted-foreground">Extras:</span>
                <ul className="ml-4 list-disc">
                  {detailTarget.extras.map((e, i) => (
                    <li key={i}>
                      {e.descripcion} — {formatCurrency(e.monto)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detailTarget.materiales.length > 0 && (
              <div>
                <span className="text-muted-foreground">Materiales:</span>
                <ul className="ml-4 list-disc">
                  {detailTarget.materiales.map((m, i) => (
                    <li key={i}>
                      {m.descripcion} {m.cantidad ? `x${m.cantidad}` : ""} — {formatCurrency(m.monto)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detailTarget.seguroCompania && (
              <p>
                <span className="text-muted-foreground">Seguro: </span>
                {detailTarget.seguroCompania} — {detailTarget.seguroCobertura} (
                {detailTarget.seguroCantidadDias ?? 0} día(s), {formatCurrency(detailTarget.seguroCosto ?? 0)})
              </p>
            )}
            {detailTarget.excedente > 0 && (
              <p>
                <span className="text-muted-foreground">Excedente de viáticos: </span>
                <Badge variant="warning">{formatCurrency(detailTarget.excedente)}</Badge>
              </p>
            )}
            {detailTarget.notes && (
              <p>
                <span className="text-muted-foreground">Notas: </span>
                {detailTarget.notes}
              </p>
            )}
            <p className="border-t border-border pt-3 font-medium">
              Total estimado: {formatCurrency(calcularTotal(detailTarget))}
            </p>
          </div>
        )}
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title="Borrar viático"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el viático{" "}
              <span className="font-medium text-foreground">{confirmTarget.nombre}</span> del{" "}
              {formatDate(confirmTarget.fechaISO)}? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingId === confirmTarget.id}
                onClick={() => performDelete(confirmTarget)}
              >
                {deletingId === confirmTarget.id ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}