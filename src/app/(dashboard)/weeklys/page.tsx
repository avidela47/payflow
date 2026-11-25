import { requireModuleAccess } from "@/lib/auth";
import { WeeklysClient } from "./weeklys-client";

export default async function WeeklysPage() {
  await requireModuleAccess("weeklys");
  return <WeeklysClient />;
}
