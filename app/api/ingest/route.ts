import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseGitHubUrl } from "@/lib/services/github";
import { runLitePipeline } from "@/lib/pipeline/lite";
import { runPipeline } from "@/lib/pipeline/run";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, mode } = body as { url?: string; mode?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 },
      );
    }

    let repoName: string;
    try {
      const { owner, repo } = parseGitHubUrl(url);
      repoName = `${owner}/${repo}`;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid GitHub URL. Provide a URL like https://github.com/owner/repo",
        },
        { status: 400 },
      );
    }

    const deep = mode === "deep";
    const sourceType = deep ? "github-deep" : "github-lite";

    const repo = await prisma.repo.create({
      data: {
        name: repoName,
        url,
        sourceType,
        status: "pending",
      },
    });

    const job = await prisma.job.create({
      data: {
        repoId: repo.id,
        step: "fetching",
        log: deep
          ? "Deep analysis job created (full download + parse)…"
          : "Lite map job created (GitHub tree only, fast)…",
      },
    });

    after(async () => {
      if (deep) {
        await runPipeline(repo.id, job.id, url);
      } else {
        await runLitePipeline(repo.id, job.id, url);
      }
    });

    return NextResponse.json(
      { repoId: repo.id, jobId: job.id, mode: deep ? "deep" : "lite" },
      { status: 201 },
    );
  } catch (err) {
    console.error("Ingest error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
