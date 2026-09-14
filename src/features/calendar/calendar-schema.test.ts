import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";
const sql=readFileSync(resolve(process.cwd(),"supabase/migrations/0027_shared_calendar_foundation.sql"),"utf8");
describe("calendar database security contract",()=>{
  it("separates personal and household visibility",()=>{expect(sql).toContain("scope='PERSONAL' and created_by=auth.uid()");expect(sql).toContain("scope='HOUSEHOLD' and public.is_household_member(household_id)")});
  it("uses date-only all-day storage and timestamptz timed storage",()=>{expect(sql).toContain("starts_at timestamptz");expect(sql).toContain("all_day_date date");expect(sql).toContain("is_all_day and all_day_date is not null and starts_at is null and ends_at is null");expect(sql).toContain("ends_at is null or ends_at >= starts_at")});
  it("prevents personal and cross-household participants",()=>{expect(sql).toContain("Personal events cannot have participants");expect(sql).toContain("foreign key(event_id, household_id)");expect(sql).toContain("foreign key(household_member_id, household_id)");expect(sql).toContain("primary key(event_id, household_member_id)")});
  it("uses RPC-only mutation and immutable authority fields",()=>{expect(sql).toContain("revoke all on public.calendar_events, public.calendar_event_participants from anon, authenticated");expect(sql).toContain("grant select on public.calendar_events, public.calendar_event_participants to authenticated");expect(sql).not.toMatch(/update public\.calendar_events set[^;]*(scope|household_id|created_by)/s)});
  it("allows household creators plus owner/admin overrides",()=>{expect(sql).toContain("v_event.created_by=auth.uid()");expect(sql).toContain("array['owner','admin']::public.household_role[]")});
  it("archives without hard deletion",()=>{expect(sql).toContain("archived_at=case when p_archived then coalesce(archived_at,now()) else null end");expect(sql).not.toMatch(/calendar_events for delete|delete from public\.calendar_events/)});
});
