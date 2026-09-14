import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/0025_pets_foundation.sql"),"utf8");

describe("pets database contract",()=>{
  it("defines controlled identity and non-destructive archive fields",()=>{expect(sql).toContain("create type public.pet_species as enum ('CAT', 'DOG', 'RABBIT', 'BIRD', 'FISH', 'OTHER')");expect(sql).toContain("create type public.pet_sex as enum ('MALE', 'FEMALE', 'UNKNOWN')");expect(sql).toContain("archived_at timestamptz");expect(sql).toContain("birthday is null or birthday <= current_date");expect(sql).not.toMatch(/pets_delete/)});
  it("makes household immutable through RPC-only writes",()=>{expect(sql).toContain("revoke all on public.pets, public.pet_caregivers from anon, authenticated");expect(sql).toContain("grant select on public.pets, public.pet_caregivers to authenticated");expect(sql).not.toMatch(/update public\.pets set[^;]*household_id/s)});
  it("enforces same-household and unique caregivers",()=>{expect(sql).toContain("primary key (pet_id, household_member_id)");expect(sql).toContain("foreign key (pet_id, household_id)");expect(sql).toContain("foreign key (household_member_id, household_id)");expect(sql).toContain("count(distinct hm.id)")});
  it("authorizes owner/admin and lets household members read",()=>{expect(sql).toContain("array['owner','admin']::public.household_role[]");expect(sql).toContain("using (public.is_household_member(household_id))")});
  it("uses a private bounded MIME-restricted photo bucket",()=>{expect(sql).toContain("values ('pet-photos','pet-photos',false,5242880");expect(sql).toContain("array['image/jpeg','image/png','image/webp']");expect(sql).toContain("public.has_household_role(((storage.foldername(name))[1])::uuid")});
  it("archives and restores without deleting caregiver rows",()=>{expect(sql).toContain("archived_at=case when p_archived then coalesce(archived_at, now()) else null end");expect(sql).not.toMatch(/set_pet_archived[\s\S]*delete from public\.pet/s)});
});
