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
import type { ViaticoHonorarioType, ViaticoPaymentMode, ViaticoEmployeePaymentMode } from "@/models/Viatico";

export type EmployeeOption = { id: string; nombre: string; apellido: string; area?: string };

// Mismos valores que VIATICO_PAYMENT_MODES en el modelo — se redeclaran
// acá (en vez de importar esa constante) porque este archivo es "use
// client" y el modelo importa mongoose, que no debe terminar en el bundle
// del navegador. El tipo sí se importa (import type se borra al compilar).
// Se usa para materiales, extras y tope diario.
const PAYMENT_MODE_OPTIONS: { value: ViaticoPaymentMode; label: string }[] = [
  { value: "TARJETA", label: "Tarjeta" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "DEBITO", label: "Débito" },
];

// Forma de pago AL EMPLEADO (honorario) — set distinto: transferencia o
// efectivo, no tarjeta/débito.
const EMPLOYEE_PAYMENT_MODE_OPTIONS: { value: ViaticoEmployeePaymentMode; label: string }[] = [
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "EFECTIVO", label: "Efectivo" },
];

export type ViaticoPagoItem = { monto: number; fechaISO: string };

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
  paymentMode?: ViaticoEmployeePaymentMode;
  // Pagos parciales hechos a este empleado a cuenta del monto total.
  pagos: ViaticoPagoItem[];
};

export type ViaticoExtraItem = { descripcion: string; monto: number; paymentMode?: ViaticoPaymentMode };
export type ViaticoMaterialItem = {
  descripcion: string;
  cantidad?: number;
  monto: number;
  paymentMode?: ViaticoPaymentMode;
};
export type ViaticoTopeGastoItem = { descripcion: string; monto: number; paymentMode?: ViaticoPaymentMode };
export type ViaticoTopeDiarioItem = {
  employeeId: string;
  employeeName?: string;
  // Importe/tope por día asignado al empleado.
  monto: number;
  // Gastos descontados de ese importe — discrimina qué se gastó y cómo
  // se pagó, sin tener que repetir la fila del empleado por cada gasto.
  gastos: ViaticoTopeGastoItem[];
};

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
  topesDiarios: ViaticoTopeDiarioItem[];
  excedente: number;
  notes?: string;
};

type PagoRow = ViaticoPagoItem & { _key: number };
type EmpleadoRow = Omit<ViaticoEmpleadoItem, "pagos"> & { _key: number; pagos: PagoRow[] };
type ExtraRow = ViaticoExtraItem & { _key: number };
type MaterialRow = ViaticoMaterialItem & { _key: number };
type TopeGastoRow = ViaticoTopeGastoItem & { _key: number };
type TopeRow = Omit<ViaticoTopeDiarioItem, "gastos"> & { _key: number; gastos: TopeGastoRow[] };

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return keySeq;
}

function emptyEmpleadoRow(): EmpleadoRow {
  return { _key: nextKey(), employeeId: "", honorarioType: "DIA", monto: 0, dias: 1, pagos: [] };
}
function emptyPagoRow(): PagoRow {
  return { _key: nextKey(), monto: 0, fechaISO: todayISO() };
}
function emptyExtraRow(): ExtraRow {
  return { _key: nextKey(), descripcion: "", monto: 0 };
}
function emptyMaterialRow(): MaterialRow {
  return { _key: nextKey(), descripcion: "", cantidad: undefined, monto: 0 };
}
function emptyTopeRow(): TopeRow {
  return { _key: nextKey(), employeeId: "", monto: 0, gastos: [] };
}
function emptyTopeGastoRow(): TopeGastoRow {
  return { _key: nextKey(), descripcion: "", monto: 0 };
}

// Cubre ambos sets (materiales/extras/tope y el de empleados) para que el
// detalle muestre bien cualquier dato ya guardado.
function paymentModeLabel(mode?: ViaticoPaymentMode | ViaticoEmployeePaymentMode): string | null {
  const found =
    PAYMENT_MODE_OPTIONS.find((o) => o.value === mode) ??
    EMPLOYEE_PAYMENT_MODE_OPTIONS.find((o) => o.value === mode);
  return found ? found.label : null;
}

// Monto total que se le debe pagar a un empleado (igual cálculo que la
// columna "Monto total"): monto x días si es por día, o monto fijo.
function montoTotalEmpleado(e: { honorarioType: ViaticoHonorarioType; monto: number; dias?: number }): number {
  return e.honorarioType === "DIA" ? e.monto * (e.dias ?? 1) : e.monto;
}

// Saldo pendiente de pago de un empleado: monto total menos la suma de
// sus pagos registrados.
function saldoEmpleado(e: {
  honorarioType: ViaticoHonorarioType;
  monto: number;
  dias?: number;
  pagos: ViaticoPagoItem[];
}): number {
  const pagado = e.pagos.reduce((sum, p) => sum + p.monto, 0);
  return montoTotalEmpleado(e) - pagado;
}

// Saldo disponible del importe de tope asignado a un empleado: el
// importe menos la suma de los gastos cargados contra él.
function saldoTope(t: { monto: number; gastos: ViaticoTopeGastoItem[] }): number {
  const gastado = t.gastos.reduce((sum, g) => sum + g.monto, 0);
  return t.monto - gastado;
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
  const [topesRows, setTopesRows] = useState<TopeRow[]>([]);

  function resetForm() {
    setNombre("");
    setPaidBy("");
    setFecha(todayISO());
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
    setTopesRows([]);
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
        ? v.empleados.map((e) => ({
            ...e,
            _key: nextKey(),
            pagos: e.pagos.map((p) => ({ ...p, _key: nextKey() })),
          }))
        : [emptyEmpleadoRow()]
    );
    setExtrasRows(v.extras.map((e) => ({ ...e, _key: nextKey() })));
    setMaterialesRows(v.materiales.map((m) => ({ ...m, _key: nextKey() })));
    setTopesRows(
      v.topesDiarios.map((t) => ({
        ...t,
        _key: nextKey(),
        gastos: t.gastos.map((g) => ({ ...g, _key: nextKey() })),
      }))
    );
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
    const topesValidos = topesRows.filter((t) => t.employeeId);
    if (topesValidos.length === 0) return 0;
    const topeByEmployee = new Map(topesValidos.map((t) => [t.employeeId, t.monto]));
    return empleadosRows.reduce((sum, e) => {
      if (e.honorarioType !== "DIA") return sum;
      const tope = topeByEmployee.get(e.employeeId);
      if (tope == null) return sum;
      const diff = e.monto - tope;
      if (diff <= 0) return sum;
      return sum + diff * (e.dias ?? 1);
    }, 0);
  }, [empleadosRows, topesRows]);

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
          paymentMode: r.paymentMode,
          pagos: r.pagos.map((p) => ({ monto: p.monto, fecha: p.fechaISO })),
        })),
      hospedajeLugar: hospedajeLugar || undefined,
      hospedajeCheckIn: hospedajeCheckIn || undefined,
      hospedajeCheckOut: hospedajeCheckOut || undefined,
      hospedajeCostoPorDia: hospedajeCostoPorDia ? Number(hospedajeCostoPorDia) : undefined,
      hospedajeCantidadDias: hospedajeCantidadDias ? Number(hospedajeCantidadDias) : undefined,
      hospedajePaidBy: hospedajePaidBy || undefined,
      combustibleMonto: combustibleMonto ? Number(combustibleMonto) : undefined,
      combustiblePaidBy: combustiblePaidBy || undefined,
      extras: extrasRows
        .filter((r) => r.descripcion)
        .map((r) => ({ descripcion: r.descripcion, monto: r.monto, paymentMode: r.paymentMode })),
      materiales: materialesRows
        .filter((r) => r.descripcion)
        .map((r) => ({
          descripcion: r.descripcion,
          cantidad: r.cantidad,
          monto: r.monto,
          paymentMode: r.paymentMode,
        })),
      seguroCompania: seguroCompania || undefined,
      seguroCobertura: seguroCobertura || undefined,
      seguroCantidadDias: seguroCantidadDias ? Number(seguroCantidadDias) : undefined,
      seguroCosto: seguroCosto ? Number(seguroCosto) : undefined,
      topesDiarios: topesRows
        .filter((r) => r.employeeId)
        .map((r) => ({
          employeeId: r.employeeId,
          monto: r.monto,
          gastos: r.gastos
            .filter((g) => g.descripcion)
            .map((g) => ({ descripcion: g.descripcion, monto: g.monto, paymentMode: g.paymentMode })),
        })),
      notes: notes || undefined,
    };

    setSaving(true);
    const result = editingId ? await updateViatico(editingId, input) : await createViatico(input);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(editingId ? "Viaje actualizado." : "Viaje guardado.");
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
    toast.success("Viaje borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {viaticos.length === 0 ? "Todavía no hay viajes cargados." : `${viaticos.length} viaje(s) cargado(s).`}
        </p>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo viaje
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
                Todavía no hay viajes cargados.
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
        title={editingId ? "Editar viaje" : "Nuevo viaje"}
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
              <div key={row._key} className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] sm:items-end">
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
                <div className="flex flex-col gap-1.5">
                  {idx === 0 && <Label>Monto total</Label>}
                  <Input
                    readOnly
                    disabled
                    className="bg-muted/50"
                    value={formatCurrency(
                      row.honorarioType === "DIA" ? row.monto * (row.dias ?? 1) : row.monto
                    )}
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
              <div className="flex flex-col gap-1.5 sm:max-w-[220px]">
                {idx === 0 && <Label>Forma de pago</Label>}
                <Select
                  value={row.paymentMode ?? ""}
                  onChange={(e) =>
                    setEmpleadosRows((rows) =>
                      rows.map((r) =>
                        r._key === row._key
                          ? {
                              ...r,
                              paymentMode: (e.target.value || undefined) as
                                | ViaticoEmployeePaymentMode
                                | undefined,
                            }
                          : r
                      )
                    )
                  }
                >
                  <option value="">Elegir...</option>
                  {EMPLOYEE_PAYMENT_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Pagos registrados a este empleado, a cuenta del monto total */}
              <div className="flex flex-col gap-2 rounded-md bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Pagos registrados</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEmpleadosRows((rows) =>
                        rows.map((r) =>
                          r._key === row._key ? { ...r, pagos: [...r.pagos, emptyPagoRow()] } : r
                        )
                      )
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Agregar pago
                  </Button>
                </div>
                {row.pagos.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin pagos registrados.</p>
                )}
                {row.pagos.map((pago) => (
                  <div key={pago._key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Monto pagado"
                      value={pago.monto || ""}
                      onChange={(e) =>
                        setEmpleadosRows((rows) =>
                          rows.map((r) =>
                            r._key === row._key
                              ? {
                                  ...r,
                                  pagos: r.pagos.map((p) =>
                                    p._key === pago._key ? { ...p, monto: Number(e.target.value) } : p
                                  ),
                                }
                              : r
                          )
                        )
                      }
                    />
                    <Input
                      type="date"
                      value={pago.fechaISO}
                      onChange={(e) =>
                        setEmpleadosRows((rows) =>
                          rows.map((r) =>
                            r._key === row._key
                              ? {
                                  ...r,
                                  pagos: r.pagos.map((p) =>
                                    p._key === pago._key ? { ...p, fechaISO: e.target.value } : p
                                  ),
                                }
                              : r
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setEmpleadosRows((rows) =>
                          rows.map((r) =>
                            r._key === row._key
                              ? { ...r, pagos: r.pagos.filter((p) => p._key !== pago._key) }
                              : r
                          )
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs">
                  {saldoEmpleado(row) <= 0 ? (
                    <Badge variant="success">Completado</Badge>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Saldo pendiente: </span>
                      <span className="font-medium">{formatCurrency(saldoEmpleado(row))}</span>
                    </>
                  )}
                </p>
              </div>
              </div>
            ))}
          </div>

          {/* Tope diario de viático, por empleado */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tope diario de viático (por empleado/día)</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setTopesRows((rows) => [...rows, emptyTopeRow()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Si el monto por día de un empleado supera el tope que le asignes acá, la diferencia se
              suma a &quot;Excedente de viáticos&quot;. Un empleado sin tope acá no genera excedente.
            </p>
            {topesRows.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin topes configurados.</p>
            )}
            {topesRows.map((row, idx) => (
              <div key={row._key} className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                  <div className="flex flex-col gap-1.5">
                    {idx === 0 && <Label>Empleado</Label>}
                    <Select
                      value={row.employeeId}
                      onChange={(e) =>
                        setTopesRows((rows) =>
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
                    {idx === 0 && <Label>Importe (tope por día)</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.monto || ""}
                      onChange={(e) =>
                        setTopesRows((rows) =>
                          rows.map((r) => (r._key === row._key ? { ...r, monto: Number(e.target.value) } : r))
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setTopesRows((rows) => rows.filter((r) => r._key !== row._key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Gastos descontados del importe de este empleado */}
                <div className="flex flex-col gap-2 rounded-md bg-muted/30 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Gastos de este importe</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setTopesRows((rows) =>
                          rows.map((r) =>
                            r._key === row._key ? { ...r, gastos: [...r.gastos, emptyTopeGastoRow()] } : r
                          )
                        )
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar gasto
                    </Button>
                  </div>
                  {row.gastos.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin gastos cargados.</p>
                  )}
                  {row.gastos.map((gasto) => (
                    <div key={gasto._key} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                      <Input
                        placeholder="Qué gasto"
                        value={gasto.descripcion}
                        onChange={(e) =>
                          setTopesRows((rows) =>
                            rows.map((r) =>
                              r._key === row._key
                                ? {
                                    ...r,
                                    gastos: r.gastos.map((g) =>
                                      g._key === gasto._key ? { ...g, descripcion: e.target.value } : g
                                    ),
                                  }
                                : r
                            )
                          )
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Monto"
                        value={gasto.monto || ""}
                        onChange={(e) =>
                          setTopesRows((rows) =>
                            rows.map((r) =>
                              r._key === row._key
                                ? {
                                    ...r,
                                    gastos: r.gastos.map((g) =>
                                      g._key === gasto._key ? { ...g, monto: Number(e.target.value) } : g
                                    ),
                                  }
                                : r
                            )
                          )
                        }
                      />
                      <Select
                        value={gasto.paymentMode ?? ""}
                        onChange={(e) =>
                          setTopesRows((rows) =>
                            rows.map((r) =>
                              r._key === row._key
                                ? {
                                    ...r,
                                    gastos: r.gastos.map((g) =>
                                      g._key === gasto._key
                                        ? {
                                            ...g,
                                            paymentMode: (e.target.value || undefined) as
                                              | ViaticoPaymentMode
                                              | undefined,
                                          }
                                        : g
                                    ),
                                  }
                                : r
                            )
                          )
                        }
                      >
                        <option value="">Forma de pago...</option>
                        {PAYMENT_MODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setTopesRows((rows) =>
                            rows.map((r) =>
                              r._key === row._key
                                ? { ...r, gastos: r.gastos.filter((g) => g._key !== gasto._key) }
                                : r
                            )
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs">
                    {saldoTope(row) < 0 ? (
                      <Badge variant="warning">Excedido en {formatCurrency(Math.abs(saldoTope(row)))}</Badge>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Saldo disponible: </span>
                        <span className="font-medium">{formatCurrency(saldoTope(row))}</span>
                      </>
                    )}
                  </p>
                </div>
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
              <div key={row._key} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
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
                <Select
                  value={row.paymentMode ?? ""}
                  onChange={(e) =>
                    setExtrasRows((rows) =>
                      rows.map((r) =>
                        r._key === row._key
                          ? { ...r, paymentMode: (e.target.value || undefined) as ViaticoPaymentMode | undefined }
                          : r
                      )
                    )
                  }
                >
                  <option value="">Forma de pago...</option>
                  {PAYMENT_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
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
              <div key={row._key} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
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
                <Select
                  value={row.paymentMode ?? ""}
                  onChange={(e) =>
                    setMaterialesRows((rows) =>
                      rows.map((r) =>
                        r._key === row._key
                          ? { ...r, paymentMode: (e.target.value || undefined) as ViaticoPaymentMode | undefined }
                          : r
                      )
                    )
                  }
                >
                  <option value="">Forma de pago...</option>
                  {PAYMENT_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
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
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Guardar viaje"}
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
                    {paymentModeLabel(e.paymentMode) ? ` (${paymentModeLabel(e.paymentMode)})` : ""}
                    {" — "}
                    {saldoEmpleado(e) <= 0 ? (
                      <Badge variant="success">Completado</Badge>
                    ) : (
                      <>Saldo: {formatCurrency(saldoEmpleado(e))}</>
                    )}
                    {e.pagos.length > 0 && (
                      <ul className="ml-4 list-[circle] text-xs text-muted-foreground">
                        {e.pagos.map((p, pi) => (
                          <li key={pi}>
                            {formatDate(p.fechaISO)} — {formatCurrency(p.monto)}
                          </li>
                        ))}
                      </ul>
                    )}
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
                      {paymentModeLabel(e.paymentMode) ? ` (${paymentModeLabel(e.paymentMode)})` : ""}
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
                      {paymentModeLabel(m.paymentMode) ? ` (${paymentModeLabel(m.paymentMode)})` : ""}
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
            {detailTarget.topesDiarios.length > 0 && (
              <div>
                <span className="text-muted-foreground">Tope diario de viático:</span>
                <ul className="ml-4 list-disc">
                  {detailTarget.topesDiarios.map((t, i) => (
                    <li key={i}>
                      {t.employeeName} — {formatCurrency(t.monto)}/día —{" "}
                      {saldoTope(t) < 0 ? (
                        <Badge variant="warning">Excedido en {formatCurrency(Math.abs(saldoTope(t)))}</Badge>
                      ) : (
                        <>Saldo: {formatCurrency(saldoTope(t))}</>
                      )}
                      {t.gastos.length > 0 && (
                        <ul className="ml-4 list-[circle] text-xs text-muted-foreground">
                          {t.gastos.map((g, gi) => (
                            <li key={gi}>
                              {g.descripcion} — {formatCurrency(g.monto)}
                              {paymentModeLabel(g.paymentMode) ? ` (${paymentModeLabel(g.paymentMode)})` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
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
        title="Borrar viaje"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el viaje{" "}
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