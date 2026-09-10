import { NextRequest, NextResponse } from "next/server";
import { runAgendaDigest } from "@/lib/agenda-digest";

// Vercel manda automáticamente `Authorization: Bearer <CRON_SECRET>` en
// cada invocación programada — así confirmamos que el pedido viene del
// cron de Vercel y no de cualquiera que encuentre la URL.
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runAgendaDigest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("agenda-digest cron error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}