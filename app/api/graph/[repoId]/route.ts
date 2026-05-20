import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params;
  return NextResponse.json({ repoId, nodes: [], edges: [] }, { status: 501 });
}
