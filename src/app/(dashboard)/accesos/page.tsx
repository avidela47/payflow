import { requireModuleAccess } from "@/lib/auth";
import { AccesosClient } from "./accesos-client";

export default async function AccesosPage() {
  await requireModuleAccess("accesos");
  return <AccesosClient />;
}
