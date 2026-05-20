import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseGitHubUrl } from "@/lib/services/github";
import { runPipeline } from "@/lib/pipeline/run";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 }
      );
    }

    // Validate it's a GitHub URL
    let repoName: string;
    try {
      const { owner, repo } = parseGitHubUrl(url);
      repoName = `${owner}/${repo}`;
    } catch {
      return NextResponse.json(
        { error: "Invalid GitHub URL. Provide a URL like https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    const repo = await prisma.repo.create({
      data: {
        name: repoName,
        url,
        sourceType: "github",
        status: "pending",
      },
    });

    const job = await prisma.job.create({
      data: {
        repoId: repo.id,
        step: "fetching",
        log: "Job created. Starting pipeline...",
      },
    });

    // Fire-and-forget: run the pipeline asynchronously
    runPipeline(repo.id, job.id, url).catch((err) => {
      console.error("Pipeline background error:", err);
    });

    return NextResponse.json(
      { repoId: repo.id, jobId: job.id },
      { status: 201 }
    );
  } catch (err) {
    console.error("Ingest error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
