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
import { EmployeeForm, type EmployeeFormValues } from "./employee-form";
import { deleteEmployee } from "./actions";

export type EmployeeListItem = EmployeeFormValues & {
  id: string;
  active: boolean;
};

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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>DNI / CUIT</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Forma de pago</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
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
              <TableCell className="font-medium">
                {emp.nombre} {emp.apellido}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {emp.dni ?? emp.cuit ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={emp.category === "MONOTRIBUTISTA" ? "default" : "primary"}>
                  {emp.category === "MONOTRIBUTISTA"
                    ? `Monotributista${emp.monotributoCategoria ? ` (${emp.monotributoCategoria})` : ""}`
                    : "Empleado"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {emp.category === "EMPLEADO"
                  ? emp.paymentType === "POR_HORA"
                    ? "Por hora"
                    : "Sueldo fijo"
                  : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {emp.telefono || emp.email || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={emp.active ? "success" : "default"}>
                  {emp.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
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