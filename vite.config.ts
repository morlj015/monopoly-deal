import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/monopoly-deal/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      include: ["src/domain/**"],
      exclude: ["src/domain/__tests__/**"],
    },
  },
});
