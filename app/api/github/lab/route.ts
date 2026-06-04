import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatDbError } from "@/lib/db-errors";
import { parseSnapshot } from "@/lib/graph/snapshot";
import { runGitHubLabTool } from "@/lib/services/github-lab";
import {
  getLabTool,
  type LabToolId,
} from "@/lib/github/lab-tool-registry";

export async function POST(req: NextRequest) {
  try {
    return await handleLabPost(req);
  } catch (err) {
    console.error("GitHub lab error:", err);
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}

async function handleLabPost(req: NextRequest) {
  let body: {
    repoId?: string;
    repoUrl?: string;
    toolId?: string;
    path?: string;
    query?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const toolId = body.toolId as LabToolId | undefined;
  if (!toolId || !getLabTool(toolId)) {
    return NextResponse.json(
      { error: "Invalid or missing toolId" },
      { status: 400 },
    );
  }

  let repoUrl = body.repoUrl?.trim() ?? "";
  let treePaths: string[] | undefined;

  if (body.repoId) {
    const repo = await prisma.repo.findUnique({
      where: { id: body.repoId },
    });
    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }
    repoUrl = repo.url ?? repoUrl;
    const snap = parseSnapshot(repo.snapshot);
    if (snap?.nodes) {
      treePaths = snap.nodes
        .filter((n) => n.type === "fileNode")
        .map((n) => (n.data as { path?: string })?.path)
        .filter((p): p is string => !!p);
    }
  }

  if (!repoUrl || !repoUrl.includes("github.com")) {
    return NextResponse.json(
      { error: "GitHub URL required (map imported repos need original URL)" },
      { status: 400 },
    );
  }

  const def = getLabTool(toolId)!;
  if (def.needsPath && !body.path?.trim()) {
    return NextResponse.json(
      { error: "This tool requires a file path (select a node on the map)" },
      { status: 400 },
    );
  }
  if (def.needsQuery && !body.query?.trim()) {
    return NextResponse.json(
      { error: "This tool requires a search query" },
      { status: 400 },
    );
  }

  const result = await runGitHubLabTool(toolId, repoUrl, {
    path: body.path,
    query: body.query,
    treePaths,
  });

  return NextResponse.json(result);
}

export async function GET() {
  const { LAB_TOOL_REGISTRY, LAB_CATEGORY_LABELS } = await import(
    "@/lib/github/lab-tool-registry"
  );
  return NextResponse.json({
    tools: LAB_TOOL_REGISTRY,
    categories: LAB_CATEGORY_LABELS,
  });
}
