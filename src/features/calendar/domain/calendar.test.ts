import { describe, expect, it } from "vitest";
import { bangkokDateKey, calendarFormSchema, monthDays, parseBangkokLocal, selectedDateForMonth, toBangkokInput } from "./calendar";

const timed={title:" Dinner ",note:"",scope:"PERSONAL",isAllDay:false,allDayDate:"",startsLocal:"2026-09-10T18:30",endsLocal:"2026-09-10T19:30",participantIds:[]};
describe("calendar event validation",()=>{
  it("accepts a valid personal timed event and preserves its Bangkok instant",()=>{expect(calendarFormSchema.parse(timed).title).toBe("Dinner");expect(parseBangkokLocal(timed.startsLocal)?.toISOString()).toBe("2026-09-10T11:30:00.000Z");expect(toBangkokInput("2026-09-10T11:30:00.000Z")).toBe(timed.startsLocal)});
  it("accepts a household event with participants",()=>expect(calendarFormSchema.safeParse({...timed,scope:"HOUSEHOLD",participantIds:["11111111-1111-4111-8111-111111111111"]}).success).toBe(true));
  it("rejects blank title",()=>expect(calendarFormSchema.safeParse({...timed,title:"  "}).success).toBe(false));
  it("rejects an end before start",()=>expect(calendarFormSchema.safeParse({...timed,endsLocal:"2026-09-10T17:00"}).success).toBe(false));
  it("keeps an all-day date as a date string without timezone conversion",()=>{const value=calendarFormSchema.parse({...timed,isAllDay:true,allDayDate:"2026-09-10",startsLocal:"",endsLocal:""});expect(value.allDayDate).toBe("2026-09-10")});
  it("rejects participants on personal events",()=>expect(calendarFormSchema.safeParse({...timed,participantIds:["11111111-1111-4111-8111-111111111111"]}).success).toBe(false));
  it("builds a stable 42-cell month grid",()=>{const days=monthDays("2026-09");expect(days).toHaveLength(42);expect(days.filter(d=>d.inMonth)).toHaveLength(30)});
});

describe("calendar initial selection", () => {
  const bangkokBoundary = new Date("2026-09-09T18:30:00.000Z");

  it("selects today's Bangkok date when opening the current month", () => {
    expect(bangkokDateKey(bangkokBoundary)).toBe("2026-09-10");
    expect(selectedDateForMonth("2026-09", undefined, bangkokBoundary)).toBe("2026-09-10");
  });

  it("selects a clicked date in the displayed month", () => {
    expect(selectedDateForMonth("2026-09", "2026-09-21", bangkokBoundary)).toBe("2026-09-21");
  });

  it("selects day one away from the current month and today when returning", () => {
    expect(selectedDateForMonth("2026-10", undefined, bangkokBoundary)).toBe("2026-10-01");
    expect(selectedDateForMonth("2026-09", undefined, bangkokBoundary)).toBe("2026-09-10");
  });
});
