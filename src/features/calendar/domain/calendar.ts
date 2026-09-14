import { z } from "zod";
import type { CalendarEventScope } from "@/types/database";

export const CALENDAR_TIME_ZONE = "Asia/Bangkok";
export const EVENT_SCOPES = ["PERSONAL","HOUSEHOLD"] as const satisfies readonly CalendarEventScope[];

export const calendarFormSchema = z.object({
  title:z.string().trim().min(1,"Event title is required").max(120), note:z.string().trim().max(2000).transform(v=>v||null),
  scope:z.enum(EVENT_SCOPES), isAllDay:z.boolean(), allDayDate:z.string(), startsLocal:z.string(), endsLocal:z.string(),
  participantIds:z.array(z.string().uuid()),
}).superRefine((value,ctx)=>{
  if(value.scope==="PERSONAL"&&value.participantIds.length) ctx.addIssue({code:"custom",message:"Personal events cannot have participants",path:["participantIds"]});
  if(value.isAllDay){if(!/^\d{4}-\d{2}-\d{2}$/.test(value.allDayDate))ctx.addIssue({code:"custom",message:"Date is required",path:["allDayDate"]});}
  else {
    const start=parseBangkokLocal(value.startsLocal); const end=value.endsLocal?parseBangkokLocal(value.endsLocal):null;
    if(!start)ctx.addIssue({code:"custom",message:"Start time is required",path:["startsLocal"]});
    if(value.endsLocal&&!end)ctx.addIssue({code:"custom",message:"Invalid end time",path:["endsLocal"]});
    if(start&&end&&end<start)ctx.addIssue({code:"custom",message:"End cannot be before start",path:["endsLocal"]});
  }
});

export function parseBangkokLocal(value:string):Date|null { if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;const d=new Date(`${value}:00+07:00`);return Number.isNaN(d.valueOf())?null:d; }
export function toBangkokInput(iso:string|null):string { if(!iso)return "";const parts=new Intl.DateTimeFormat("en-CA",{timeZone:CALENDAR_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)?.value;return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`; }
export function formatEventTime(iso:string):string { return new Intl.DateTimeFormat("th-TH",{timeZone:CALENDAR_TIME_ZONE,hour:"2-digit",minute:"2-digit"}).format(new Date(iso)); }
export function monthKey(value:string|undefined,now=new Date()):string { return value&&/^\d{4}-\d{2}$/.test(value)?value:new Intl.DateTimeFormat("en-CA",{timeZone:CALENDAR_TIME_ZONE,year:"numeric",month:"2-digit"}).format(now); }
export function bangkokDateKey(now=new Date()):string { const parts=new Intl.DateTimeFormat("en-CA",{timeZone:CALENDAR_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value;return `${get("year")}-${get("month")}-${get("day")}`; }
export function selectedDateForMonth(month:string,requested:string|undefined,now=new Date()):string { const today=bangkokDateKey(now);if(requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested)&&requested.startsWith(`${month}-`))return requested;return month===today.slice(0,7)?today:`${month}-01`; }
export function monthDays(month:string):Array<{date:string;inMonth:boolean}> { const [y,m]=month.split("-").map(Number);const first=new Date(Date.UTC(y,m-1,1));const offset=first.getUTCDay();return Array.from({length:42},(_,i)=>{const d=new Date(Date.UTC(y,m-1,i-offset+1));const date=d.toISOString().slice(0,10);return {date,inMonth:d.getUTCMonth()===m-1};}); }
export function shiftMonth(month:string,amount:number){const[y,m]=month.split("-").map(Number);const d=new Date(Date.UTC(y,m-1+amount,1));return d.toISOString().slice(0,7);}
