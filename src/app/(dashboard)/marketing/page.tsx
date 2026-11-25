import { requireModuleAccess } from "@/lib/auth";
import { MarketingClient } from "./marketing-client";

export default async function MarketingPage() {
  await requireModuleAccess("marketing");
  return <MarketingClient />;
}
