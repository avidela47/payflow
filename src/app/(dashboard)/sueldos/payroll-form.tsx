"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatPeriod } from "@/lib/utils";
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

// "YYYY-MM" -> { year, month } con month 1-indexado.
function parsePeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return { year, month };
}

// "YYYY-MM" -> Date del primer día de ese mes.
function periodToDate(period: string) {
  const { year, month } = parsePeriod(period);
  return new Date(year, month - 1, 1);
}

// Suma (o resta, con delta negativo) meses a un "YYYY-MM".
function shiftPeriod(period: string, deltaMonths: number) {
  const { year, month } = parsePeriod(period);
  const date = new Date(year, month - 1 + deltaMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function PayrollForm({ employees }: { employees: PayrollEmployeeOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  // Mes en que efectivamente se paga (lo que elige/edita el usuario). La
  // imputación contable (el campo "period" que se manda al servidor)
  // SIEMPRE es el mes anterior a este — automático, sin excepción: si se
  // paga en octubre, se imputa a septiembre, y así siempre.
  const [paymentMonth, setPaymentMonth] = useState(currentPeriod());
  const imputationPeriod = shiftPeriod(paymentMonth, -1);
  const imputationLabel = formatPeriod(periodToDate(imputationPeriod));

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
    // El servidor sólo recibe la imputación (mes anterior al de pago), no
    // el mes de pago en sí — "period" sigue siendo, como siempre, el
    // período contable.
    formData.set("period", shiftPeriod(paymentMonth, -1));

    const result = await createPayrollEntry(formData);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Pago registrado.");
    formRef.current?.reset();
    setEmployeeId("");
    setPaymentMonth(currentPeriod());
    resetAmounts();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employeeId">Empleado</Label>
          <Select
            id="employeeId"
            name="employeeId"
            required
            value={employeeId}
            onChange={(e) => selectEmployee(e.target.value)}
          >
            <option value="">Elegir...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentMonth">Mes de pago</Label>
          <Input
            id="paymentMonth"
            name="paymentMonth"
            type="month"
            required
            value={paymentMonth}
            onChange={(e) => setPaymentMonth(e.target.value)}
          />
          <p className="text-xs capitalize text-muted-foreground">
            Se imputa a: {imputationLabel}
          </p>
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