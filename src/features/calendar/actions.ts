"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { createCalendarEvent,getCalendarEvent,setCalendarEventArchived,updateCalendarEvent } from "./api";
import { calendarFormSchema,parseBangkokLocal } from "./domain/calendar";
import type { CalendarEventScope } from "@/types/database";

function parse(form:FormData,scope:CalendarEventScope){return calendarFormSchema.safeParse({title:form.get("title"),note:form.get("note"),scope,isAllDay:form.get("isAllDay")==="on",allDayDate:form.get("allDayDate")??"",startsLocal:form.get("startsLocal")??"",endsLocal:form.get("endsLocal")??"",participantIds:form.getAll("participantIds")})}
function write(v:z.infer<typeof calendarFormSchema>){return {title:v.title,note:v.note,isAllDay:v.isAllDay,allDayDate:v.isAllDay?v.allDayDate:null,startsAt:v.isAllDay?null:parseBangkokLocal(v.startsLocal)!.toISOString(),endsAt:v.isAllDay||!v.endsLocal?null:parseBangkokLocal(v.endsLocal)!.toISOString(),participantIds:v.scope==="PERSONAL"?[]:v.participantIds}}

export async function createCalendarEventAction(_s:ActionState,form:FormData):Promise<ActionState>{const{supabase,user}=await requireUser();const scope=form.get("scope");if(scope!=="PERSONAL"&&scope!=="HOUSEHOLD")return{error:"Invalid event type"};const parsed=parse(form,scope);if(!parsed.success)return{error:parsed.error.issues[0]?.message??"Invalid input"};const household=scope==="HOUSEHOLD"?await getMyPrimaryHousehold(supabase,user.id):null;if(scope==="HOUSEHOLD"&&!household)return{error:"Household not found"};const id=randomUUID();try{await createCalendarEvent(supabase,{id,scope,householdId:household?.id??null,...write(parsed.data)})}catch(error){logDatabaseErrorInDev("createCalendarEventAction failed",error);return{error:"Could not create event"}}revalidatePath("/calendar");redirect(`/calendar/${id}`)}
export async function updateCalendarEventAction(_s:ActionState,form:FormData):Promise<ActionState>{const{supabase,user}=await requireUser();const id=form.get("eventId");if(typeof id!=="string")return{error:"Event not found"};const current=await getCalendarEvent(supabase,id,user.id);if(!current)return{error:"Event not found"};const parsed=parse(form,current.scope);if(!parsed.success)return{error:parsed.error.issues[0]?.message??"Invalid input"};try{await updateCalendarEvent(supabase,id,write(parsed.data))}catch(error){logDatabaseErrorInDev("updateCalendarEventAction failed",error);return{error:"Could not update event"}}revalidatePath("/calendar");revalidatePath(`/calendar/${id}`);redirect(`/calendar/${id}`)}
export async function archiveCalendarEventAction(form:FormData){const{supabase}=await requireUser();const id=form.get("eventId");if(typeof id!=="string")return;try{await setCalendarEventArchived(supabase,id,form.get("archived")==="true")}catch(error){logDatabaseErrorInDev("archiveCalendarEventAction failed",error);return}revalidatePath("/calendar");revalidatePath(`/calendar/${id}`);redirect(`/calendar/${id}`)}
