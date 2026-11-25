import { requireModuleAccess } from "@/lib/auth";
import { ComputoPrivadoClient } from "./computo-privado-client";

export default async function ComputoPrivadoPage() {
  await requireModuleAccess("computo-privado");
  return <ComputoPrivadoClient />;
}
