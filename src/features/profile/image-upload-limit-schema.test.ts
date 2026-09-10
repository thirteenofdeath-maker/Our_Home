import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0026_raise_image_upload_limits.sql"), "utf8");

describe("final image bucket upload limits", () => {
  it("raises both existing buckets to exactly 15 MiB without changing policies", () => {
    expect(sql).toContain("file_size_limit = 15728640");
    expect(sql).toContain("where id in ('avatars', 'pet-photos')");
    expect(sql).not.toMatch(/create policy|allowed_mime_types|public\s*=/);
  });
});
