import type { Database, HouseholdRole } from "@/types/database";

export type Household = Database["public"]["Tables"]["households"]["Row"];
export type HouseholdMemberRow = Database["public"]["Tables"]["household_members"]["Row"];

export interface HouseholdMemberWithProfile extends HouseholdMemberRow {
  profile: { display_name: string; email: string } | null;
}

export interface HouseholdWithRole extends Household {
  myRole: HouseholdRole;
}
