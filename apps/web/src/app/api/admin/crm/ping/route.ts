import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { pingTwenty } from "@/lib/crm/twenty/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getPayload({ config: configPromise });
  const auth = await payload.auth({ headers: await headers() });
  if (!auth.user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const result = await pingTwenty();
  return NextResponse.json(result);
}
