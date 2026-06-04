import { NextRequest, NextResponse } from "next/server";
import { validateDesignMd } from "@/lib/design/validate-design-md";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const content = body.content as string | undefined;
    if (!content?.trim()) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }
    const result = validateDesignMd(content);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lint failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
