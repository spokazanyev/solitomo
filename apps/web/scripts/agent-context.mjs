import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "../..");
const contextPath = path.join(repoRoot, "agent-project-context.md");

try {
  const context = await fs.readFile(contextPath, "utf8");
  process.stdout.write(context);
} catch (error) {
  console.error(`Cannot read agent context at ${contextPath}`);
  console.error(error);
  process.exitCode = 1;
}
