import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      "src/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/__test-utils__/server-only-shim.ts"),
      "@payload-config": path.resolve(__dirname, "./src/__test-utils__/payload-config-shim.ts"),
    },
  },
});
