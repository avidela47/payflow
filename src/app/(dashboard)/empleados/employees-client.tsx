"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Dialog } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { EmployeeForm, type EmployeeFormValues } from "./employee-form";
import { deleteEmployee } from "./actions";
import EmployeeCard from "./employee-card";

export type EmployeeListItem = EmployeeFormValues & {
  id: string;
  active: boolean;
};

// Iniciales del nombre para el avatar circular.
function getInitials(nombre?: string, apellido?: string): string {
  const first = (nombre ?? "").trim();
  const last = (apellido ?? "").trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return "?";
}

// Color del avatar según el tipo de empleado (no por id como antes):
// rojo = monotributista, verde = relación de dependencia.
function avatarColorClass(category?: string): string {
  return category === "MONOTRIBUTISTA" ? "bg-destructive" : "bg-success";
}

// Avatar chico de la tabla (el disparador del hover card).
function EmployeeAvatar({ emp }: { emp: EmployeeListItem }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
      {emp.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={emp.foto} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-[10px] font-bold text-white ${avatarColorClass(emp.category)}`}
        >
          {getInitials(emp.nombre, emp.apellido)}
        </div>
      )}
    </div>
  );
}

export function EmployeesClient({ employees }: { employees: EmployeeListItem[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeListItem | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<EmployeeListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function performDelete(emp: EmployeeListItem) {
    setDeletingId(emp.id);
    const result = await deleteEmployee(emp.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Empleado borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empleados</h1>
          <p className="text-sm text-muted-foreground">
            Ficha de cada persona: datos de contacto y tipo.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Nuevo empleado</Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>DNI / CUIT</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Forma de pago</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Todavía no hay empleados cargados.
              </TableCell>
            </TableRow>
          )}
          {employees.map((emp) => (
            <TableRow key={emp.id}>
              <TableCell>
                <HoverCard openDelay={150}>
                  <HoverCardTrigger asChild>
                    <div className="flex min-w-0 cursor-pointer items-center gap-2">
                      <EmployeeAvatar emp={emp} />
                      <div className="min-w-0 truncate font-medium">
                        {emp.nombre} {emp.apellido}
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-auto rounded-none border-0 bg-transparent p-0 shadow-none">
                    <EmployeeCard
                      nombre={`${emp.nombre} ${emp.apellido}`.trim()}
                      cargo={
                        emp.area ||
                        (emp.category === "MONOTRIBUTISTA" ? "Monotributista" : "Empleado")
                      }
                      imagen={emp.foto}
                      fallbackInitials={getInitials(emp.nombre, emp.apellido)}
                      fallbackColorClass={avatarColorClass(emp.category)}
                      ingresoIso={emp.fechaIngreso}
                      logo="/logo2.png"
                      activo={emp.active}
                      onVerPerfil={() => setEditing(emp)}
                    />
                  </HoverCardContent>
                </HoverCard>
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {emp.dni ?? emp.cuit ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={emp.category === "MONOTRIBUTISTA" ? "default" : "primary"}>
                  {emp.category === "MONOTRIBUTISTA"
                    ? `Monotributista${emp.monotributoCategoria ? ` (${emp.monotributoCategoria})` : ""}`
                    : "Empleado"}
                </Badge>
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {emp.category === "EMPLEADO"
                  ? emp.paymentType === "POR_HORA"
                    ? "Por hora"
                    : "Sueldo fijo"
                  : "—"}
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {emp.telefono || emp.email || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={emp.active ? "success" : "default"}>
                  {emp.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                    onClick={() => setEditing(emp)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmTarget(emp)}
                  >
                    Borrar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Nuevo empleado">
        <EmployeeForm mode="create" onSuccess={() => setCreateOpen(false)} />
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing ? `${editing.nombre} ${editing.apellido}` : undefined}
      >
        {editing && (
          <EmployeeForm
            mode="edit"
            employeeId={editing.id}
            defaultValues={editing}
            onSuccess={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title="Borrar empleado"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar a{" "}
              <span className="font-medium text-foreground">
                {confirmTarget.nombre} {confirmTarget.apellido}
              </span>
              ? No se puede deshacer.
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
    </div>
  );
}