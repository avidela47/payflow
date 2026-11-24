import { requireModuleAccess } from "@/lib/auth";
import { ComputosClient } from "./computos-client";

// Fase 1 del Generador de Cómputos (ver comentario en computos-client.tsx).
// Sin fetch de Mongo acá: a diferencia de Proyectos, el original guarda el
// proyecto del cómputo como texto libre (no referencia un cliente de
// PayFlow), así que todo vive del lado del cliente contra Firestore.
export default async function ComputosPage() {
  await requireModuleAccess("computos");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Generador de Cómputos</h1>
        <p className="text-sm text-muted-foreground">
          Armado de cómputos de luminarias por proyecto — misma base en vivo que proyectos-itelsa.itelsasas.com.
        </p>
      </div>
      <ComputosClient />
    </div>
  );
}
