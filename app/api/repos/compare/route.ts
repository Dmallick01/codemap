import { NextRequest, NextResponse } from "next/server";
import { getRepoStats } from "@/lib/repos/stats";
import type { ArchRole } from "@/lib/graph/semantic";

export async function GET(req: NextRequest) {
  const leftId = req.nextUrl.searchParams.get("left");
  const rightId = req.nextUrl.searchParams.get("right");

  if (!leftId || !rightId) {
    return NextResponse.json(
      { error: "left and right repo ids required" },
      { status: 400 },
    );
  }

  if (leftId === rightId) {
    return NextResponse.json(
      { error: "Choose two different repositories" },
      { status: 400 },
    );
  }

  const [left, right] = await Promise.all([
    getRepoStats(leftId),
    getRepoStats(rightId),
  ]);

  if (!left || !right) {
    return NextResponse.json(
      { error: "One or both repos not found" },
      { status: 404 },
    );
  }

  const leftRoles = new Set(left.roles.map((r) => r.role));
  const rightRoles = new Set(right.roles.map((r) => r.role));

  const onlyLeft: ArchRole[] = [...leftRoles].filter((r) => !rightRoles.has(r));
  const onlyRight: ArchRole[] = [...rightRoles].filter((r) => !leftRoles.has(r));
  const shared: ArchRole[] = [...leftRoles].filter((r) => rightRoles.has(r));

  return NextResponse.json({
    left,
    right,
    diff: {
      onlyLeft,
      onlyRight,
      shared,
      fileCountDelta: left.fileCount - right.fileCount,
      edgeCountDelta: left.edgeCount - right.edgeCount,
    },
  });
}
