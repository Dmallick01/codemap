import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatDbError } from "@/lib/db-errors";
import { commitDesignMdToGitHub } from "@/lib/services/design-github";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repoId = body.repoId as string | undefined;
    const designMd = (body.designMd as string | undefined)?.trim() ?? "";
    const commitToGithub = !!body.commitToGithub;

    if (!repoId) {
      return NextResponse.json({ error: "repoId required" }, { status: 400 });
    }
    if (!designMd) {
      return NextResponse.json({ error: "designMd required" }, { status: 400 });
    }

    const repo = await prisma.repo.findUnique({ where: { id: repoId } });
    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }

    await prisma.repo.update({
      where: { id: repoId },
      data: { designMd },
    });

    let github: { ok: boolean; sha?: string; error?: string } = { ok: false };
    if (commitToGithub && repo.url?.includes("github.com")) {
      const result = await commitDesignMdToGitHub(repo.url, designMd);
      github = result.ok
        ? { ok: true, sha: result.sha }
        : { ok: false, error: result.error };
    }

    return NextResponse.json({
      saved: true,
      bytes: designMd.length,
      github,
    });
  } catch (err) {
    console.error("design/save:", err);
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const repoId = req.nextUrl.searchParams.get("repoId");
    if (!repoId) {
      return NextResponse.json({ error: "repoId required" }, { status: 400 });
    }

    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      select: { designMd: true, url: true, name: true },
    });
    if (!repo) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }

    return NextResponse.json({
      designMd: repo.designMd ?? "",
      hasSaved: !!repo.designMd?.trim(),
      repoUrl: repo.url,
      repoName: repo.name,
    });
  } catch (err) {
    console.error("design/load:", err);
    return NextResponse.json({ error: formatDbError(err) }, { status: 500 });
  }
}
