import { defineConfig, configDefaults } from "vitest/config";

const testExcludes: string[] = ["conf/**", "public/**", "src/setupTests.ts", "src/**/*.d.ts"];

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: "node",
    exclude: [...configDefaults.exclude, ...testExcludes],
    coverage: {
      provider: "v8",
      reporter: ["lcov", "json", "html"],
      include: ["src/**/*.{ts,tsx,js,jsx}"],
      enabled: true,
    },
    testTimeout: 10_000,
  },
});
