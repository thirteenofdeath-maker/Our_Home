import type { CoverTone } from "@/components/shared/TopLevelCover";

const BANGKOK_TIME_ZONE = "Asia/Bangkok";

function bangkokParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    monthDay: `${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

export function getDayCover(
  now: Date,
  birthday: string | null | undefined,
  displayName: string,
): { title: string; description: string; tone: CoverTone } {
  const { hour, monthDay } = bangkokParts(now);
  if (birthday?.slice(5) === monthDay) {
    return {
      title: `สุขสันต์วันเกิด ${displayName}`,
      description: "วันนี้เป็นวันของนาย ขอให้บ้านของเราเต็มไปด้วยเรื่องดี ๆ",
      tone: "birthday",
    };
  }
  if (hour >= 5 && hour < 11) {
    return {
      title: `อรุณสวัสดิ์ ${displayName}`,
      description: "เริ่มเช้าวันใหม่ พร้อมดูแลทุกเรื่องในบ้านไปด้วยกัน",
      tone: "morning",
    };
  }
  if (hour >= 11 && hour < 16) {
    return {
      title: `สวัสดีตอนกลางวัน ${displayName}`,
      description: "เช็กเรื่องสำคัญของวันนี้ แล้วค่อยไปต่ออย่างสบายใจ",
      tone: "day",
    };
  }
  if (hour >= 16 && hour < 19) {
    return {
      title: `สวัสดีตอนเย็น ${displayName}`,
      description: "กลับมาเช็กความเรียบร้อยของบ้านก่อนพักผ่อนกัน",
      tone: "evening",
    };
  }
  return {
    title: `ค่ำคืนนี้ ${displayName}`,
    description: "สรุปสิ่งที่ผ่านไป และเตรียมบ้านให้พร้อมสำหรับวันพรุ่งนี้",
    tone: "night",
  };
}
