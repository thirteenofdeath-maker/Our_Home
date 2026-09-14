import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import type { BillBaseStatus, BillDisplayStatus } from "./types";

export function billDisplayStatus(status:BillBaseStatus,dueDate:string,now=new Date()):BillDisplayStatus {
  if(status==="PAID"||status==="SKIPPED") return status;
  const today=bangkokDateKey(now);
  return dueDate<today?"OVERDUE":dueDate===today?"DUE":"UPCOMING";
}

export const billStatusLabel:Record<BillDisplayStatus,string>={UPCOMING:"ใกล้ครบกำหนด",DUE:"ครบกำหนดวันนี้",OVERDUE:"เกินกำหนด",PAID:"จ่ายแล้ว",SKIPPED:"ข้ามแล้ว"};
