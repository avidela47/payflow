"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { createPayrollEntry } from "./actions";

export type PayrollEmployeeOption = {
  id: string;
  name: string;
  category: "MONOTRIBUTISTA" | "EMPLEADO";
  paymentType?: "FIJO" | "POR_HORA";
  hourlyRate?: number;
};

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function PayrollForm({ employees }: { employees: PayrollEmployeeOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  // Monto directo: Monotributo/Viáticos (monotributista) o
  // Registrado/Informal con sueldo fijo (empleado). La parte "informal"
  // (Viáticos) SIEMPRE es un monto directo, incluso si el empleado es
  // por hora — los viáticos no se calculan por hora.
  const [registradoAmount, setRegistradoAmount] = useState("");
  const [informalAmount, setInformalAmount] = useState("");

  // Solo para "por hora": valor hora y cantidad de horas de la parte
  // registrada.
  const [registradoRate, setRegistradoRate] = useState("");
  const [registradoHours, setRegistradoHours] = useState("");

  const employee = employees.find((e) => e.id === employeeId);
  const isMonotributista = employee?.category === "MONOTRIBUTISTA";
  const isPorHora = employee?.category === "EMPLEADO" && employee.paymentType === "POR_HORA";

  const finalRegistrado = isPorHora
    ? (Number(registradoRate) || 0) * (Number(registradoHours) || 0)
    : Number(registradoAmount) || 0;
  const finalInformal = Number(informalAmount) || 0;
  const total = finalRegistrado + finalInformal;

  function resetAmounts() {
    setRegistradoAmount("");
    setInformalAmount("");
    setRegistradoHours("");
    setRegistradoRate("");
  }

  function selectEmployee(id: string) {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    resetAmounts();
    if (emp?.hourlyRate) {
      setRegistradoRate(String(emp.hourlyRate));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (finalRegistrado <= 0 && finalInformal <= 0) {
      toast.error("Ingresá al menos un monto mayor a cero.");
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("registradoAmount", String(finalRegistrado));
    formData.set("informalAmount", String(finalInformal));

    const result = await createPayrollEntry(formData);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Pago registrado.");
    formRef.current?.reset();
    setEmployeeId("");
    resetAmounts();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employeeId">Empleado</Label>
          <select
            id="employeeId"
            name="employeeId"
            required
            value={employeeId}
            onChange={(e) => selectEmployee(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Elegir...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="period">Período</Label>
          <Input id="period" name="period" type="month" required defaultValue={currentPeriod()} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paidBy">Lo paga</Label>
          <Input id="paidBy" name="paidBy" placeholder="ITELSA / Rubén..." />
        </div>
      </div>

      {employee && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Parte "registrada": Monotributo (monotributista) o Registrado (empleado) */}
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <span className="text-sm font-medium">
              {isMonotributista ? "Monotributo" : "Registrado"}
            </span>
            {isPorHora ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="registradoRate">Valor hora</Label>
                  <Input
                    id="registradoRate"
                    type="number"
                    step="0.01"
                    value={registradoRate}
                    onChange={(e) => setRegistradoRate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="registradoHours">Cant. horas</Label>
                  <Input
                    id="registradoHours"
                    type="number"
                    step="0.5"
                    value={registradoHours}
                    onChange={(e) => setRegistradoHours(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <Input
                type="number"
                step="0.01"
                value={registradoAmount}
                onChange={(e) => setRegistradoAmount(e.target.value)}
              />
            )}
            {isPorHora && (
              <p className="text-xs text-muted-foreground">
                Subtotal: {formatCurrency(finalRegistrado)}
              </p>
            )}
          </div>

          {/* Parte "informal": Viáticos (monotributista, o empleado por hora)
              o Informal (empleado con sueldo fijo). Siempre un monto
              directo — los viáticos no se calculan por hora. */}
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <span className="text-sm font-medium">
              {isMonotributista || isPorHora ? "Viáticos" : "Informal"}
            </span>
            <Input
              type="number"
              step="0.01"
              value={informalAmount}
              onChange={(e) => setInformalAmount(e.target.value)}
            />
          </div>
        </div>
      )}

      {employee && (
        <div className="text-sm font-medium">Total: {formatCurrency(total)}</div>
      )}

      <div>
        <Button type="submit" disabled={loading || !employee}>
          {loading ? "Guardando..." : "Registrar pago"}
        </Button>
      </div>
    </form>
  );
}