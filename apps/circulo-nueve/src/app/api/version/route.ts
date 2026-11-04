import { NextResponse } from "next/server";
import { APP_VERSION, versionActual } from "@/modulos/version/version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ version: versionActual(), numero: APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
