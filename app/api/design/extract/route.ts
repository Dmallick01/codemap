import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSnapshot } from "@/lib/graph/snapshot";
import { fetchRepoFilesAtPaths } from "@/lib/services/github-contents";
import {
  extractTokensFromSources,
  pickStylePaths,
} from "@/lib/design/extract-tokens";
import { generateDesignMd } from "@/lib/design/generate-design-md";
import { formatDbError } from "@/lib/db-errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repoId = body.repoId as string | undefined;
    let repoUrl = (body.repoUrl as string | undefined)?.trim() ?? "";
    let treePaths: string[] = body.treePaths ?? [];

    if (repoId) {
      const repo = await prisma.repo.findUnique({
        where: { id: repoId },
        select: { url: true, snapshot: true, designMd: true, name: true },
      });
      if (!repo) {
        return NextResponse.json({ error: "Repo not found" }, { status: 404 });
      }
      if (body.preferSaved && repo.designMd?.trim()) {
        return NextResponse.json({
          designMd: repo.designMd,
          tokens: null,
          stylePaths: [],
          filesFetched: 0,
          fromSaved: true,
        });
      }
      repoUrl = repo.url ?? repoUrl;
      const snap = parseSnapshot(repo.snapshot);
      if (snap?.nodes && !treePaths.length) {
        treePaths = snap.nodes
          .filter((n) => n.type === "fileNode")
          .map((n) => (n.data as { path?: string })?.path)
          .filter((p): p is string => !!p);
      }
    }

    if (!repoUrl?.includes("github.com")) {
      return NextResponse.json(
        { error: "GitHub URL required to extract styles" },
        { status: 400 },
      );
    }

    const stylePaths = pickStylePaths(treePaths);
    let files: { path: string; content: string }[] = [];

    if (stylePaths.length) {
      const fetched = await fetchRepoFilesAtPaths(repoUrl, stylePaths);
      files = fetched
        .filter((f) => f.content?.trim())
        .map((f) => ({ path: f.path, content: f.content }));
    }

    const tokens = extractTokensFromSources(files);
    const repoName =
      (body.repoName as string) ?? repoUrl.split("/").slice(-2).join("/");
    const designMd = generateDesignMd(tokens, {
      name: repoName,
      repoUrl,
      description: `Extracted from ${tokens.sources.length} style file(s)`,
    });

    return NextResponse.json({
      designMd,
      tokens,
      stylePaths,
      filesFetched: files.length,
    });
  } catch (err) {
    console.error("design/extract:", err);
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}
