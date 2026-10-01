/**
 * Create the single owner account from the terminal (recommended):
 *   npm run owner:create -- --email you@example.com --name "Your Name"
 * The password is read from the OWNER_PASSWORD environment variable or prompted
 * for interactively (never pass it as a command-line argument).
 */
import { loadEnvConfig } from "@next/env";
import { createInterface } from "node:readline/promises";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function readPassword(): Promise<string> {
  if (process.env.OWNER_PASSWORD) return process.env.OWNER_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Owner password (min 12 characters): ");
  rl.close();
  return password;
}

async function main() {
  const email = arg("email");
  const name = arg("name") ?? "Owner";
  if (!email) throw new Error('Usage: npm run owner:create -- --email you@example.com [--name "Name"]');
  const { createOwner } = await import("@/lib/auth/owner");
  const { closeDb } = await import("@/lib/db/client");
  const password = await readPassword();
  const result = await createOwner({ email, name, password });
  await closeDb();
  if (!result.ok) throw new Error(result.error);
  console.log(`Owner account created for ${email}. Sign in at ${process.env.APP_URL ?? "http://localhost:3000"}/sign-in`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
