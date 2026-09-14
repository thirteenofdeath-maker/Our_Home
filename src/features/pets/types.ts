import type { HouseholdMemberWithProfile } from "@/features/household/types";
import type { Database } from "@/types/database";

export type Pet = Database["public"]["Tables"]["pets"]["Row"];
export type PetWithCaregivers = Pet & { caregivers: HouseholdMemberWithProfile[]; photoUrl: string | null };
