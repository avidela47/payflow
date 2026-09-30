import Link from "next/link";
import { Landmark, FileDigit, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Check } from "@/models/Check";

// Landing de Cheques (v2, estructura estilo app del banco): acá solo se
// elige Físicos o Electrónicos; adentro de cada uno (/cheques/[tipo]) se
// elige Recibidos / Emitidos / Endosados, y recién ahí aparece la lista
// filtrada. Antes esto era una sola página con una tabla gigante mezclando
// todo — a pedido de Ariel, ahora es la misma navegación en cascada que
// tiene la app de Galicia para e-cheqs.
export default async function ChequesPage() {
  await requireModuleAccess("cheques");
  await connectDB();

  const [fisicosCount, electronicosCount] = await Promise.all([
    Check.countDocuments({ type: "FISICO" }),
    Check.countDocuments({ type: "ELECTRONICO" }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cheques</h1>
        <p className="text-sm text-muted-foreground">
          Elegí el tipo de cheque para ver recibidos, emitidos y endosados.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/cheques/fisicos" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/10">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-md shadow-rose-500/25">
                <Landmark className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Físicos</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {fisicosCount} cheque{fisicosCount === 1 ? "" : "s"} en papel cargado
                  {fisicosCount === 1 ? "" : "s"}.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-rose-600" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/cheques/electronicos" className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/25">
                <FileDigit className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="font-semibold">Electrónicos (e-cheq)</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {electronicosCount} e-cheq{electronicosCount === 1 ? "" : "s"} cargado
                  {electronicosCount === 1 ? "" : "s"}.
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}