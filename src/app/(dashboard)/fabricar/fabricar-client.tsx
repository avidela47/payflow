"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Factory, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { confirmarFabricacion } from "./actions";

export type RecetaFabricable = {
  codigo: string;
  nombre: string;
  version: number;
  componentes: {
    componenteId: string;
    codigoComponente: string;
    descripcionComponente: string;
    cantidad: number;
  }[];
};

export type ComponenteStock = {
  id: string;
  codigo: string;
  descripcion: string;
  stockActual: number;
  unidad: string;
};

export type ProduccionItem = {
  id: string;
  numero: string;
  codigoLuminaria: string;
  nombreLuminaria: string;
  versionReceta: number;
  cantidad: number;
  operario: string;
  notas?: string;
  createdAtISO: string;
};

type ItemValidacion = {
  codigo: string;
  descripcion: string;
  necesario: number;
  disponible: number;
  unidad: string;
  ok: boolean;
};

export function FabricarClient({
  recetas,
  componentes,
  producciones,
}: {
  recetas: RecetaFabricable[];
  componentes: ComponenteStock[];
  producciones: ProduccionItem[];
}) {
  const router = useRouter();
  const [codigoReceta, setCodigoReceta] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState("");
  const [validacion, setValidacion] = useState<ItemValidacion[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const recetaSeleccionada = recetas.find((r) => r.codigo === codigoReceta);

  // Solo una previsualización con el stock que trajo la página — la
  // validación que de verdad decide (y la que bloquea todo-o-nada) se hace
  // de nuevo en el servidor con datos recién leídos, ver actions.ts.
  function verificarStock() {
    if (!recetaSeleccionada || cantidad < 1) return;

    const items: ItemValidacion[] = recetaSeleccionada.componentes.map((linea) => {
      const comp = componentes.find((c) => c.id === linea.componenteId);
      const necesario = linea.cantidad * cantidad;
      const disponible = comp?.stockActual ?? 0;
      return {
        codigo: linea.codigoComponente,
        descripcion: comp?.descripcion ?? linea.descripcionComponente,
        necesario,
        disponible,
        unidad: comp?.unidad ?? "UNIDAD",
        ok: disponible >= necesario,
      };
    });

    setValidacion(items);
  }

  const puedeProducir = validacion !== null && validacion.every((v) => v.ok);

  async function confirmarProduccion() {
    if (!puedeProducir || !recetaSeleccionada) return;

    setConfirmando(true);
    const formData = new FormData();
    formData.set("codigoReceta", recetaSeleccionada.codigo);
    formData.set("cantidad", String(cantidad));
    formData.set("notas", notas);

    const result = await confirmarFabricacion(formData);
    setConfirmando(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(`Fabricación registrada: ${cantidad} unidad${cantidad > 1 ? "es" : ""} de ${recetaSeleccionada.codigo}.`);
    setCodigoReceta("");
    setCantidad(1);
    setNotas("");
    setValidacion(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div>
            <Label>Luminaria *</Label>
            <Select
              value={codigoReceta}
              onChange={(e) => {
                setCodigoReceta(e.target.value);
                setValidacion(null);
              }}
            >
              <option value="">Seleccionar luminaria...</option>
              {recetas.map((r) => (
                <option key={r.codigo} value={r.codigo}>
                  {r.codigo} — {r.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cantidad *</Label>
            <Input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => {
                setCantidad(Number(e.target.value));
                setValidacion(null);
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Notas</Label>
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: Pedido cliente X"
          />
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={verificarStock}
            disabled={!codigoReceta || cantidad < 1}
          >
            <Factory className="h-4 w-4" />
            Verificar stock
          </Button>
        </div>
      </div>

      {validacion && (
        <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            Componentes necesarios para {cantidad} unidad{cantidad > 1 ? "es" : ""} de {codigoReceta}
          </h2>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead>Necesario</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validacion.map((v, i) => (
                <TableRow key={`${v.codigo}-${i}`}>
                  <TableCell>
                    <div className="font-medium">{v.codigo}</div>
                    <div className="text-xs text-muted-foreground">{v.descripcion}</div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {v.necesario} {v.unidad}
                  </TableCell>
                  <TableCell className={v.ok ? "font-semibold text-success" : "font-semibold text-destructive"}>
                    {v.disponible} {v.unidad}
                  </TableCell>
                  <TableCell>
                    {v.ok ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle className="h-3.5 w-3.5" /> OK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" /> Falta {v.necesario - v.disponible} {v.unidad}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            {puedeProducir ? (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold text-success">
                  <CheckCircle className="h-4 w-4" />
                  Stock suficiente para fabricar {cantidad} unidad{cantidad > 1 ? "es" : ""}
                </div>
                <Button type="button" onClick={confirmarProduccion} disabled={confirmando}>
                  <Factory className="h-4 w-4" />
                  {confirmando ? "Registrando..." : "Confirmar fabricación"}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Stock insuficiente — no se puede fabricar la cantidad solicitada
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Historial de fabricaciones
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Luminaria</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Operario</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {producciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Todavía no se registró ninguna fabricación.
                </TableCell>
              </TableRow>
            ) : (
              producciones.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.numero}</TableCell>
                  <TableCell>{new Date(p.createdAtISO).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.codigoLuminaria}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.nombreLuminaria} · v{p.versionReceta}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">x{p.cantidad}</Badge>
                  </TableCell>
                  <TableCell>{p.operario}</TableCell>
                  <TableCell className="text-muted-foreground">{p.notas || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
