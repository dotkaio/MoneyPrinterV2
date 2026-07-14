import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/infrastructure/database/schema.ts",
  out: "./migrations/generated",
  dbCredentials: {
    url: process.env.MPV2_DATABASE_PATH ?? "./data/moneyprinter.sqlite",
  },
});
