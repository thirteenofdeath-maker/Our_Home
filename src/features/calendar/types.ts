import type { HouseholdMemberWithProfile } from "@/features/household/types";
import type { Database } from "@/types/database";
export type CalendarEvent=Database["public"]["Tables"]["calendar_events"]["Row"];
export type CalendarEventView=CalendarEvent&{participants:HouseholdMemberWithProfile[];creatorName:string;creatorColor:string};
