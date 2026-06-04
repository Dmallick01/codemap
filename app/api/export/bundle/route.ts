import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchRepoFilesAtPaths } from "@/lib/services/github-contents";
import { fetchDeepSnippetsFromDb } from "@/lib/export/deep-snippets";
import { MAX_BUNDLE_PATHS } from "@/lib/export/bundle";

function needsGithubFallback(f: {
  content: string;
  error?: string;
}): boolean {
  return !f.content.trim() || !!f.error;
}

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
    let sourceType: string | null = null;

    if (repoId) {
      const repo = await prisma.repo.findUnique({
        where: { id: repoId },
        select: { url: true, sourceType: true },
      });
      if (!repo) {
        return NextResponse.json({ error: "Repo not found" }, { status: 404 });
      }
      repoUrl = repo.url;
      sourceType = repo.sourceType;
    }

    const isDeep = sourceType === "github-deep";
    let files = isDeep && repoId
      ? await fetchDeepSnippetsFromDb(repoId, paths)
      : [];

    const fromDb = files.filter((f) => f.content.trim()).length;
    let fromGithub = 0;

    const missing = isDeep
      ? paths.filter((p) => {
          const hit = files.find((f) => f.path === p);
          return !hit || needsGithubFallback(hit);
        })
      : paths;

    if (missing.length && repoUrl) {
      const ghFiles = await fetchRepoFilesAtPaths(repoUrl, missing);
      fromGithub = ghFiles.filter((f) => f.content.trim()).length;
      const ghByPath = new Map(ghFiles.map((f) => [f.path, f]));
      if (isDeep) {
        files = paths.map((p) => {
          const db = files.find((f) => f.path === p);
          if (db && db.content.trim() && !db.error) return db;
          return ghByPath.get(p) ?? db ?? {
            path: p,
            content: "",
            truncated: false,
            error: "Could not load",
            source: "github" as const,
          };
        });
      } else {
        files = ghFiles;
        fromGithub = ghFiles.filter((f) => f.content.trim()).length;
      }
    } else if (!isDeep && repoUrl) {
      files = await fetchRepoFilesAtPaths(repoUrl, paths);
      fromGithub = files.filter((f) => f.content.trim()).length;
    }

    return NextResponse.json({
      files,
      meta: {
        mode: isDeep ? "deep" : "lite",
        fromDatabase: fromDb,
        fromGithub,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
