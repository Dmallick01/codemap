import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      repo: {
        select: { id: true, name: true, status: true, errorMsg: true },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    step: job.step,
    progress: job.progress,
    total: job.total,
    log: job.log,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    repo: job.repo,
  });
}
