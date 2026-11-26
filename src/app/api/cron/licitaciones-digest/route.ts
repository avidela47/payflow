import { NextRequest, NextResponse } from "next/server";
import { runLicitacionesDigest } from "@/lib/licitaciones-digest";

// Mismo mecanismo que /api/cron/agenda-digest (ver ese archivo): el VPS le
// pega a esta URL por crontab con `Authorization: Bearer <CRON_SECRET>` —
// acá solo semanal en vez de diario.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runLicitacionesDigest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("licitaciones-digest cron error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
