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
    },
  });

  return NextResponse.json({ repos });
}
