import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchRepoFilesAtPaths } from "@/lib/services/github-contents";
import { MAX_BUNDLE_PATHS } from "@/lib/export/bundle";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoId, repoUrl: urlParam, paths } = body as {
      repoId?: string;
      repoUrl?: string;
      paths?: string[];
    };

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: "paths array is required" },
        { status: 400 },
      );
    }

    if (paths.length > MAX_BUNDLE_PATHS) {
      return NextResponse.json(
        { error: `At most ${MAX_BUNDLE_PATHS} paths per bundle` },
        { status: 400 },
      );
    }

    let repoUrl = urlParam ?? null;
    if (repoId) {
      const repo = await prisma.repo.findUnique({
        where: { id: repoId },
        select: { url: true },
      });
      if (!repo) {
        return NextResponse.json({ error: "Repo not found" }, { status: 404 });
      }
      repoUrl = repo.url;
    }

    if (!repoUrl) {
      return NextResponse.json(
        { error: "repoUrl or repoId with stored URL required" },
        { status: 400 },
      );
    }

    const files = await fetchRepoFilesAtPaths(repoUrl, paths);
    return NextResponse.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
