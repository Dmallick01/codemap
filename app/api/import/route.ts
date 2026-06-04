import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  serializeSnapshot,
  validateSnapshotInput,
  type CodemapSnapshot,
} from "@/lib/graph/snapshot";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let snapshot: CodemapSnapshot | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      const text = await (file as File).text();
      snapshot = validateSnapshotInput(JSON.parse(text));
    } else {
      const body = await req.json();
      snapshot = validateSnapshotInput(
        (body as { snapshot?: unknown }).snapshot ?? body,
      );
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: "Invalid .codemap.json snapshot" },
        { status: 400 },
      );
    }

    const repo = await prisma.repo.create({
      data: {
        name: snapshot.name,
        url: snapshot.url,
        sourceType: snapshot.sourceType || "imported",
        storageMode: "snapshot",
        status: "done",
        snapshot: serializeSnapshot({
          ...snapshot,
          exportedAt: snapshot.exportedAt || new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json(
      { repoId: repo.id, name: repo.name },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
