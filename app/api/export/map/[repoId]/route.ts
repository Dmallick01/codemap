import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/graph/snapshot";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;

  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
    select: { name: true, snapshot: true },
  });

  if (!repo) {
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });
  }

  const snapshot = parseSnapshot(repo.snapshot);
  if (!snapshot) {
    return NextResponse.json(
      {
        error:
          "No snapshot on this repo. Use Export map in the browser or re-map with Lite.",
      },
      { status: 404 },
    );
  }

  const body = JSON.stringify(snapshot, null, 2);
  const safeName = repo.name.replace(/[^\w.-]+/g, "-");
  const filename = `${safeName}.codemap.json`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
