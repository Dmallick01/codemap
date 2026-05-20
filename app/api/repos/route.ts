import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const repos = await prisma.repo.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      url: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const result = repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    status: repo.status,
    createdAt: repo.createdAt,
    url: repo.url,
    latestJobId: repo.jobs[0]?.id ?? null,
  }));

  return NextResponse.json({ repos: result });
}
