import { Card, CardContent } from "@/components/ui/card";

// Módulo pendiente — modelo HourLog ya definido en src/models/HourLog.ts.
export default function HorasPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Horas</h1>
        <p className="text-sm text-muted-foreground">
          Registro de horas y cálculo de pago para personal por hora (ej. Andrea).
        </p>
      </div>
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Módulo siguiente en el plan de construcción — ver ARCHITECTURE.md, sección 3.
        </CardContent>
      </Card>
    </div>
  );
}
