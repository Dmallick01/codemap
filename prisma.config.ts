import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Neon: use DIRECT_URL (unpooled) for migrations when set on Vercel
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
