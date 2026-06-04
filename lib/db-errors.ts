export function formatDbError(err: unknown): string {
  if (err instanceof Error) {
    const code =
      "code" in err && typeof (err as { code: unknown }).code === "string"
        ? (err as { code: string }).code
        : null;

    if (code === "P2022") {
      return "Database schema is out of date. Redeploy after migrations run.";
    }
    if (code === "P1001") {
      return "Cannot reach database. Check DATABASE_URL on Vercel.";
    }
    if (err.message.includes("DATABASE_URL")) {
      return err.message;
    }
    if (err.message.includes("storageMode") || err.message.includes("snapshot")) {
      return "Database schema is out of date (missing snapshot columns).";
    }
    return err.message;
  }
  return "Unknown database error";
}
