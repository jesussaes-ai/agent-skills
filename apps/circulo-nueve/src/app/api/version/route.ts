import { NextResponse } from "next/server";
import { versionActual } from "@/modulos/version/version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ version: versionActual() }, { headers: { "Cache-Control": "no-store" } });
}
