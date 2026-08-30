import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { path, secret } = body;

  // E201: normalize both sides to "" so an UNCONFIGURED secret (env unset)
  // matches the empty secret the backend sends — the strict `!==` on
  // undefined vs "" 401'd every server-side revalidation ping. When a real
  // secret is configured, the check remains strict on both sides.
  if ((secret ?? "") !== (process.env.ISR_REVALIDATE_SECRET ?? "")) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  if (!path || typeof path !== "string") {
    return NextResponse.json({ message: "Path is required" }, { status: 400 });
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  } catch {
    return NextResponse.json({ message: "Revalidation failed" }, { status: 500 });
  }
}
