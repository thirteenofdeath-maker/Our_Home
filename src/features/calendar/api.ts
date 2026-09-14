import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listHouseholdMembers } from "@/features/household/api";
import { getCurrentProfile } from "@/features/profile/api";
import type { CalendarEventScope, Database } from "@/types/database";
import type { CalendarEvent,CalendarEventView } from "./types";

async function hydrate(supabase:SupabaseClient<Database>,events:CalendarEvent[],householdId:string|null,userId:string):Promise<CalendarEventView[]>{
  const members=householdId?await listHouseholdMembers(supabase,householdId):[];const own=await getCurrentProfile(supabase,userId);const ids=events.map(e=>e.id);
  const links=ids.length?await supabase.from("calendar_event_participants").select("event_id,household_member_id").in("event_id",ids):{data:[],error:null};if(links.error)throw links.error;
  return events.map(event=>{const creator=members.find(m=>m.user_id===event.created_by);return {...event,participants:members.filter(m=>links.data?.some(l=>l.event_id===event.id&&l.household_member_id===m.id)),creatorName:creator?.profile?.display_name||creator?.profile?.email||(event.created_by===userId?own?.display_name:"Member")||"Member",creatorColor:creator?.member_color||"#7A9E7E"};});
}
export async function listCalendarEvents(supabase:SupabaseClient<Database>,householdId:string|null,userId:string,archived=false){const base=supabase.from("calendar_events").select("*");const q=(householdId?base.or(`created_by.eq.${userId},household_id.eq.${householdId}`):base.eq("created_by",userId)).order("all_day_date").order("starts_at").order("id");const {data,error}=archived?await q.not("archived_at","is",null):await q.is("archived_at",null);if(error)throw error;return hydrate(supabase,data??[],householdId,userId)}
export async function getCalendarEvent(supabase:SupabaseClient<Database>,id:string,userId:string){const{data,error}=await supabase.from("calendar_events").select("*").eq("id",id).maybeSingle();if(error)throw error;if(!data)return null;return (await hydrate(supabase,[data],data.household_id,userId))[0]??null}
export async function getCalendarHouseholdRole(supabase:SupabaseClient<Database>,householdId:string,userId:string){const{data,error}=await supabase.from("household_members").select("role").eq("household_id",householdId).eq("user_id",userId).maybeSingle();if(error)throw error;return data?.role??null}
type Write={title:string;note:string|null;isAllDay:boolean;allDayDate:string|null;startsAt:string|null;endsAt:string|null;participantIds:string[]};
export async function createCalendarEvent(s:SupabaseClient<Database>,v:Write&{id:string;scope:CalendarEventScope;householdId:string|null}){const{data,error}=await s.rpc("create_calendar_event",{p_id:v.id,p_scope:v.scope,p_household_id:v.householdId,p_title:v.title,p_note:v.note,p_is_all_day:v.isAllDay,p_all_day_date:v.allDayDate,p_starts_at:v.startsAt,p_ends_at:v.endsAt,p_member_ids:v.participantIds});if(error)throw error;return data}
export async function updateCalendarEvent(s:SupabaseClient<Database>,id:string,v:Write){const{data,error}=await s.rpc("update_calendar_event",{p_event_id:id,p_title:v.title,p_note:v.note,p_is_all_day:v.isAllDay,p_all_day_date:v.allDayDate,p_starts_at:v.startsAt,p_ends_at:v.endsAt,p_member_ids:v.participantIds});if(error)throw error;return data}
export async function setCalendarEventArchived(s:SupabaseClient<Database>,id:string,archived:boolean){const{error}=await s.rpc("set_calendar_event_archived",{p_event_id:id,p_archived:archived});if(error)throw error}
