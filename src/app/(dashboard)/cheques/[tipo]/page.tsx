import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox, Send, Stamp, ArrowRight, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Check } from "@/models/Check";
import { isTipoSlug, TIPO_LABELS, checkFilterFor, type TipoSlug } from "../shared";

// Rediseño (vuelta a neutro, igual que Dashboard/Sidebar/Reportes): antes
// Recibidos/Emitidos/Endosados tenían primary/destructive/warning solo para
// diferenciarse a simple vista — pero ninguno de los tres es un estado real
// (un cheque emitido no es un error, uno endosado no es una alerta), así que
// usar esos tokens ahí era el mismo anti-patrón que se corrigió en
// Reportes. Ahora las 3 tarjetas comparten el mismo acento (primary).
export default async function ChequesTipoPage({ params }: { params: { tipo: string } }) {
  await requireModuleAccess("cheques");

  if (!isTipoSlug(params.tipo)) {
    notFound();
  }
  const tipo = params.tipo as TipoSlug;

  await connectDB();
  const [recibidosCount, emitidosCount, endosadosCount] = await Promise.all([
    Check.countDocuments(checkFilterFor(tipo, "recibidos")),
    Check.countDocuments(checkFilterFor(tipo, "emitidos")),
    Check.countDocuments(checkFilterFor(tipo, "endosados")),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/cheques"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Cheques
        </Link>
        <h1 className="text-2xl font-semibold">Cheques {TIPO_LABELS[tipo]}</h1>
        <p className="text-sm text-muted-foreground">
          Elegí si querés ver los recibidos, los que emitió ITELSA, o los endosados.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href={`/cheques/${tipo}/recibidos`} className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Inbox className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <div>
                <p className="font-semibold">Recibidos</p>
                <p className="text-xs text-muted-foreground">De clientes, a cobrar o endosar</p>
              </div>
              <p className="text-xl font-semibold tracking-tight">{recibidosCount}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/cheques/${tipo}/emitidos`} className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <div>
                <p className="font-semibold">Emitidos</p>
                <p className="text-xs text-muted-foreground">Los que ITELSA le dio a alguien</p>
              </div>
              <p className="text-xl font-semibold tracking-tight">{emitidosCount}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/cheques/${tipo}/endosados`} className="group">
          <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Stamp className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <div>
                <p className="font-semibold">Endosados</p>
                <p className="text-xs text-muted-foreground">Recibidos y pasados a un tercero</p>
              </div>
              <p className="text-xl font-semibold tracking-tight">{endosadosCount}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}