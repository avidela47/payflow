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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

// Logos de marca en SVG inline, decorativos — sin link real (todavía no
// cargamos redes sociales reales por empleado).
function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H7.9V12h2.6V9.8c0-2.6 1.5-4 3.9-4 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M16.5 2c.3 2.4 1.8 4 4.4 4.2v3.1c-1.5.1-2.9-.4-4.4-1.3v6.6c0 3.6-2.6 6.4-6.3 6.4-1.6 0-3-.5-4.1-1.5A6.3 6.3 0 0 1 4 14.6c0-3.5 2.8-6.3 6.3-6.3.4 0 .8 0 1.2.1v3.3c-.4-.1-.8-.2-1.2-.2-1.7 0-3 1.3-3 3s1.3 3.1 3 3.1 3.1-1.3 3.1-3.1V2h3.1z" />
    </svg>
  );
}

function EmployeeAvatar({
  emp,
  size,
}: {
  emp: EmployeeListItem;
  size: "sm" | "lg";
}) {
  const dimension = size === "sm" ? "h-7 w-7" : "h-28 w-28";
  const shape = size === "sm" ? "rounded-full" : "rounded-2xl";
  const fit = size === "sm" ? "object-cover" : "object-contain";
  const textSize = size === "sm" ? "text-[10px]" : "text-lg";

  return (
    <div className={`flex ${dimension} shrink-0 items-center justify-center overflow-hidden ${shape} bg-muted`}>
      {emp.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={emp.foto} alt="" className={`h-full w-full ${fit}`} />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${textSize} font-bold text-white ${avatarColorClass(emp.category)}`}
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
                      <EmployeeAvatar emp={emp} size="sm" />
                      <div className="min-w-0 truncate font-medium">
                        {emp.nombre} {emp.apellido}
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <div className="flex flex-col items-center gap-3 text-center">
                      <EmployeeAvatar emp={emp} size="lg" />
                      <div>
                        <p className="font-semibold">
                          {emp.nombre} {emp.apellido}
                        </p>
                        {emp.area && (
                          <p className="text-sm font-medium text-primary">{emp.area}</p>
                        )}
                      </div>
                      {emp.fechaIngreso && (
                        <p className="text-xs text-muted-foreground">
                          Ingresó: {formatDate(emp.fechaIngreso)}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <InstagramIcon />
                        <FacebookIcon />
                        <TikTokIcon />
                      </div>
                    </div>
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