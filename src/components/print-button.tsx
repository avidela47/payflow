"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botón chiquito compartido por las vistas de impresión — se oculta solo
// al imprimir (print:hidden) porque no tiene sentido que salga en el PDF.
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" />
      Imprimir / Guardar como PDF
    </Button>
  );
}