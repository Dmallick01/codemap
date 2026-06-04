import { PrismaClient } from "../app/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: conn }),
});

const activeJobs = await prisma.job.findMany({
  where: { step: { notIn: ["done", "error"] } },
  include: { repo: { select: { name: true } } },
});

const activeRepos = await prisma.repo.findMany({
  where: { status: { in: ["pending", "processing"] } },
});

console.log(
  `Found ${activeJobs.length} active job(s), ${activeRepos.length} active repo(s)`,
);

for (const j of activeJobs) {
  console.log(`  job ${j.id} [${j.step}] ${j.repo?.name ?? ""}`);
}

const jobRes = await prisma.job.updateMany({
  where: { step: { notIn: ["done", "error"] } },
  data: {
    step: "error",
    log: "Cancelled: processing cleared by admin.",
  },
});

const repoRes = await prisma.repo.updateMany({
  where: { status: { in: ["pending", "processing"] } },
  data: {
    status: "error",
    errorMsg: "Cancelled: processing cleared by admin.",
  },
});

console.log(`Cancelled ${jobRes.count} job(s), ${repoRes.count} repo(s).`);
await prisma.$disconnect();
