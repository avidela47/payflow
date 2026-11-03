"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmployee, updateEmployee } from "./actions";

type Category = "MONOTRIBUTISTA" | "EMPLEADO";
type PaymentType = "FIJO" | "POR_HORA";

// Mismo tope que valida el servidor — avisamos acá antes de mandar el
// archivo, para no hacer esperar el viaje al server por nada.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export type EmployeeFormValues = {
  nombre?: string;
  apellido?: string;
  dni?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  fechaIngreso?: string; // "YYYY-MM-DD"
  notas?: string;
  category?: Category;
  monotributoCategoria?: string;
  paymentType?: PaymentType;
  cuit?: string;
  hourlyRate?: number;
  banco?: string;
  cbuAlias?: string;
  area?: string;
  foto?: string;
};

export function EmployeeForm({
  mode,
  employeeId,
  defaultValues,
  onSuccess,
}: {
  mode: "create" | "edit";
  employeeId?: string;
  defaultValues?: EmployeeFormValues;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<Category>(defaultValues?.category ?? "EMPLEADO");
  const [paymentType, setPaymentType] = useState<PaymentType>(
    defaultValues?.paymentType ?? "FIJO"
  );
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(defaultValues?.foto);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("La imagen pesa más de 2MB. Comprimila antes de subirla.");
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }

    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    let result: { ok: boolean; error?: string } | undefined;
    try {
      result =
        mode === "create"
          ? await createEmployee(formData)
          : await updateEmployee(employeeId as string, formData);
    } catch (err) {
      // Si el pedido nunca llegó a nuestra Server Action (ej. el proxy del
      // VPS lo cortó antes por el tamaño del archivo), acá no hay un
      // `result` prolijo — mostramos un error en vez de romper la página.
      console.error("Employee form submit error:", err);
      setLoading(false);
      toast.error(
        "No se pudo guardar. Si subiste una foto, puede ser demasiado pesada para el servidor — probá con una más chica."
      );
      return;
    }

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    if (mode === "create") {
      toast.success("Empleado creado.");
      formRef.current?.reset();
      setCategory("EMPLEADO");
      setPaymentType("FIJO");
      setPhotoPreview(undefined);
    } else {
      toast.success("Ficha actualizada.");
    }
    router.refresh();
    onSuccess?.();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="Foto" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Sin foto</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foto">Foto (tipo avatar, máx. 2MB)</Label>
          <Input
            id="foto"
            name="foto"
            type="file"
            accept="image/*"
            ref={photoInputRef}
            onChange={handlePhotoChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" name="nombre" required defaultValue={defaultValues?.nombre} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apellido">Apellido</Label>
          <Input id="apellido" name="apellido" required defaultValue={defaultValues?.apellido} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" name="dni" defaultValue={defaultValues?.dni} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" name="telefono" defaultValue={defaultValues?.telefono} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="direccion">Dirección</Label>
          <Input id="direccion" name="direccion" defaultValue={defaultValues?.direccion} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fechaIngreso">Fecha de ingreso</Label>
          <Input
            id="fechaIngreso"
            name="fechaIngreso"
            type="date"
            defaultValue={defaultValues?.fechaIngreso}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area">Área</Label>
          <Input
            id="area"
            name="area"
            placeholder="Ej: Ventas, Depósito, Administración"
            defaultValue={defaultValues?.area}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cuit">CUIT</Label>
          <Input id="cuit" name="cuit" defaultValue={defaultValues?.cuit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banco">Banco / Billetera virtual</Label>
          <Input
            id="banco"
            name="banco"
            placeholder="Ej: Banco Galicia, Mercado Pago, Ualá"
            defaultValue={defaultValues?.banco}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cbuAlias">CBU/CVU o Alias</Label>
          <Input id="cbuAlias" name="cbuAlias" defaultValue={defaultValues?.cbuAlias} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Tipo</Label>
          <select
            id="category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="EMPLEADO">Empleado</option>
            <option value="MONOTRIBUTISTA">Monotributista</option>
          </select>
        </div>

        {category === "MONOTRIBUTISTA" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monotributoCategoria">Categoría de monotributo</Label>
            <Input
              id="monotributoCategoria"
              name="monotributoCategoria"
              placeholder="Ej. Categoría C"
              defaultValue={defaultValues?.monotributoCategoria}
            />
          </div>
        )}

        {category === "EMPLEADO" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentType">Forma de pago</Label>
            <select
              id="paymentType"
              name="paymentType"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="FIJO">Sueldo fijo</option>
              <option value="POR_HORA">Por hora</option>
            </select>
          </div>
        )}

        {category === "EMPLEADO" && paymentType === "POR_HORA" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hourlyRate">Valor hora</Label>
            <Input
              id="hourlyRate"
              name="hourlyRate"
              type="number"
              step="0.01"
              defaultValue={defaultValues?.hourlyRate}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas</Label>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          defaultValue={defaultValues?.notas}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div>
        <Button type="submit" disabled={loading}>
          {loading
            ? "Guardando..."
            : mode === "create"
              ? "Crear empleado"
              : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}