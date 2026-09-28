"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type SectionKey = "home" | "finance" | "plan" | "pets" | "family";

type TimelineItem = {
  time: string;
  title: string;
  detail: string;
  tone: "sage" | "peach" | "blue" | "gold";
  icon: string;
};

type PreviewSection = {
  label: string;
  icon: string;
  cover: string;
  coverAlt: string;
  kicker: string;
  title: string;
  subtitle: string;
  focusEyebrow: string;
  focusTitle: string;
  focusDetail: string;
  focusItems: string[];
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
    icon: string;
    tone: "sage" | "peach" | "blue" | "gold";
  }>;
  timelineTitle: string;
  timeline: TimelineItem[];
  rail: Array<{
    title: string;
    value?: string;
    detail: string;
    icon: string;
  }>;
};

const SECTIONS: Record<SectionKey, PreviewSection> = {
  home: {
    label: "หน้าหลัก",
    icon: "⌂",
    cover: "/art/home-evening.webp",
    coverAlt: "ครอบครัวพักผ่อนในบ้านพร้อมสัตว์เลี้ยงยามเย็น",
    kicker: "วันจันทร์ที่ 28 กันยายน 2569",
    title: "บ้านของเรา",
    subtitle: "เรื่องสำคัญของบ้านอยู่ตรงกลาง และทุกความเคลื่อนไหวเรียงตามเวลา",
    focusEyebrow: "สิ่งสำคัญตอนนี้",
    focusTitle: "เหลือ 3 เรื่องก่อนพัก",
    focusDetail: "เริ่มจากรายการที่ใกล้ถึงเวลาก่อน แล้วบ้านวันนี้ก็เรียบร้อย",
    focusItems: ["ชำระบัตร ฿3,200", "ซื้อของอีก 2 ชิ้น", "ให้ยาหนมปัง 20:00"],
    metrics: [
      { label: "งานบ้าน", value: "18/28", detail: "สำเร็จแล้ว 64%", icon: "🧹", tone: "peach" },
      { label: "เงินคงเหลือ", value: "฿14,612", detail: "เดือนกันยายน", icon: "👛", tone: "sage" },
      { label: "คลังของในบ้าน", value: "4 รายการ", detail: "ควรเติม 1 รายการ", icon: "📦", tone: "gold" },
    ],
    timelineTitle: "เรื่องราวของบ้านวันนี้",
    timeline: [
      { time: "08:12", title: "รดน้ำต้นไม้เสร็จแล้ว", detail: "งานบ้าน · สมาชิกอีกคน", tone: "sage", icon: "✓" },
      { time: "09:46", title: "รายรับเข้า Cash Box +฿1.18", detail: "MAKE by KBank", tone: "gold", icon: "฿" },
      { time: "17:45", title: "แวะซื้อของเข้าบ้าน", detail: "อาหารแมวและทิชชู่ · งบ ฿650", tone: "blue", icon: "🛒" },
      { time: "18:00", title: "ชำระบัตร SEasyCash", detail: "ครบกำหนดวันนี้ · ฿3,200", tone: "peach", icon: "💳" },
      { time: "20:00", title: "ให้ยาหนมปังหลังอาหาร", detail: "กิจวัตรสัตว์เลี้ยง", tone: "sage", icon: "🐾" },
    ],
    rail: [
      { title: "สัตว์เลี้ยง", value: "5 ตัว", detail: "สุขภาพปกติดี", icon: "🐾" },
      { title: "รายการซื้อของ", value: "4/6", detail: "เหลืออีก 2 รายการ", icon: "🛒" },
      { title: "พรุ่งนี้", detail: "ซักผ้า · ตรวจคลังของ", icon: "📅" },
    ],
  },
  finance: {
    label: "การเงิน",
    icon: "▥",
    cover: "/art/finance-corner.webp",
    coverAlt: "มุมการเงินแสนอบอุ่น มีกระเป๋า บ้านจำลอง และต้นไม้",
    kicker: "การเงินส่วนตัว · กันยายน 2569",
    title: "การเงินของบ้าน",
    subtitle: "เห็นภาพรวมเงิน บิล และกำหนดจ่ายตามลำดับเวลาในหน้าเดียว",
    focusEyebrow: "ทรัพย์สินสุทธิ",
    focusTitle: "฿14,612.13",
    focusDetail: "รายรับมากกว่ารายจ่าย และยังอยู่ในงบของเดือนนี้",
    focusItems: ["รายรับ ฿18,211.13", "รายจ่าย ฿3,599.00", "ครบกำหนด 1 บิล"],
    metrics: [
      { label: "งบประมาณ", value: "24%", detail: "ใช้ไป ฿3,599", icon: "◔", tone: "sage" },
      { label: "เป้าหมาย", value: "฿8,000", detail: "จาก ฿50,000", icon: "⚑", tone: "gold" },
      { label: "หนี้สิน", value: "2 บัญชี", detail: "คงเหลือ ฿8,966.02", icon: "💳", tone: "blue" },
    ],
    timelineTitle: "รายการล่าสุดและกำลังจะถึง",
    timeline: [
      { time: "1 ก.ย.", title: "เงินเดือนเข้า +฿18,000", detail: "MAKE by KBank", tone: "sage", icon: "↑" },
      { time: "28 ก.ย.", title: "ค่าอาหาร -฿484", detail: "อาหาร · รายจ่ายส่วนตัว", tone: "peach", icon: "↓" },
      { time: "29 ก.ย.", title: "ชำระบัตรเครดิต", detail: "วันครบกำหนดชำระ · ฿3,599", tone: "peach", icon: "💳" },
      { time: "1 ต.ค.", title: "วันตัดยอด SEasyCash", detail: "แก้ไขวันตัดยอดและวันครบกำหนดได้", tone: "gold", icon: "📅" },
      { time: "3 ต.ค.", title: "บิลค่าน้ำ", detail: "ประมาณ ฿560", tone: "blue", icon: "◉" },
    ],
    rail: [
      { title: "กระเป๋าหลัก", value: "3 กระเป๋า", detail: "Pocket ทั้งหมด 5", icon: "👛" },
      { title: "บิลเดือนนี้", value: "4 รายการ", detail: "ใกล้ครบกำหนด 1", icon: "📆" },
      { title: "เป้าหมายออม", value: "24%", detail: "เดินหน้าตามแผน", icon: "🌱" },
    ],
  },
  plan: {
    label: "แผนงาน",
    icon: "□",
    cover: "/art/plan-calendar.webp",
    coverAlt: "ปฏิทินและสมุดแผนงานในมุมบ้านแสนอบอุ่น",
    kicker: "สัปดาห์ที่ 28 กันยายน – 4 ตุลาคม",
    title: "แผนงานของเรา",
    subtitle: "ปฏิทิน งาน เตือน และโน้ตเชื่อมกันเป็นเรื่องเดียว",
    focusEyebrow: "โฟกัสวันนี้",
    focusTitle: "3 งาน · 1 นัดหมาย",
    focusDetail: "งานที่ต้องทำวันนี้ถูกเรียงให้พร้อมเริ่มจากเวลาที่ใกล้ที่สุด",
    focusItems: ["ซื้อของ 17:45", "ชำระบัตร 18:00", "ให้ยา 20:00"],
    metrics: [
      { label: "ความคืบหน้า", value: "2/5", detail: "เหลือ 3 รายการ", icon: "✓", tone: "sage" },
      { label: "งานบ้าน", value: "18/28", detail: "งานหมุนเวียน", icon: "🧹", tone: "peach" },
      { label: "กำลังจะถึง", value: "17:45", detail: "ซื้อของเข้าบ้าน", icon: "◷", tone: "blue" },
    ],
    timelineTitle: "วันนี้จนถึงสุดสัปดาห์",
    timeline: [
      { time: "วันนี้ 17:45", title: "ซื้อของเข้าบ้าน", detail: "เหลือ 2 จาก 6 รายการ", tone: "blue", icon: "🛒" },
      { time: "วันนี้ 19:30", title: "เก็บห้องครัวและทิ้งขยะ", detail: "งานหมุนเวียน 2 รายการ", tone: "sage", icon: "🧹" },
      { time: "1 ต.ค.", title: "วันตัดยอด SEasyCash", detail: "แจ้งเตือนล่วงหน้า 3 วัน", tone: "gold", icon: "฿" },
      { time: "3 ต.ค. 10:30", title: "พาชานมไปคลินิก", detail: "วัคซีนประจำปี", tone: "peach", icon: "🐾" },
      { time: "4 ต.ค. 16:00", title: "ทำความสะอาดใหญ่", detail: "สมาชิกทุกคน · 90 นาที", tone: "sage", icon: "⌂" },
    ],
    rail: [
      { title: "ปฏิทิน", value: "กันยายน", detail: "เลือกวันที่ 28", icon: "📅" },
      { title: "รายการซื้อของ", value: "4/6", detail: "เหลืออาหารแมวและทิชชู่", icon: "🛒" },
      { title: "โน้ตปักหมุด", detail: "อาหารแมวเหลือประมาณ 3 วัน", icon: "📌" },
    ],
  },
  pets: {
    label: "สัตว์เลี้ยง",
    icon: "♧",
    cover: "/art/pets-garden.webp",
    coverAlt: "แมวสี่ตัวและกระต่ายในสวนของบ้าน",
    kicker: "สมาชิกตัวน้อยของบ้าน · 5 ตัว",
    title: "สัตว์เลี้ยงของเรา",
    subtitle: "กิจวัตร สุขภาพ น้ำหนัก และนัดหมายอยู่ในเส้นเวลาเดียวกัน",
    focusEyebrow: "สุขภาพวันนี้",
    focusTitle: "ทุกตัวปกติดี",
    focusDetail: "เหลือกิจวัตรเย็นอีก 2 รายการ และอาหารแมวใกล้หมด",
    focusItems: ["อาหารเย็น 18:30", "ยาหนมปัง 20:00", "เติมน้ำแล้ว ✓"],
    metrics: [
      { label: "หนมปัง", value: "6.7 kg", detail: "น้ำหนักล่าสุด", icon: "🐱", tone: "sage" },
      { label: "กิจวัตรวันนี้", value: "4/6", detail: "เหลืออีก 2 รายการ", icon: "✓", tone: "blue" },
      { label: "อาหารคงเหลือ", value: "3 วัน", detail: "ควรเพิ่มลงรายการซื้อ", icon: "🥣", tone: "gold" },
    ],
    timelineTitle: "ประวัติการดูแล",
    timeline: [
      { time: "07:15", title: "อาหารเช้าและเติมน้ำ", detail: "แมว 4 ตัว · กระต่าย 1 ตัว", tone: "sage", icon: "🥣" },
      { time: "09:30", title: "หนมปัง · น้ำหนัก 6.7 kg", detail: "คงที่จากครั้งก่อน", tone: "blue", icon: "⚖" },
      { time: "13:00", title: "เติมหญ้าทิโมธี", detail: "กระต่ายกินอาหารและขับถ่ายปกติ", tone: "gold", icon: "🌿" },
      { time: "20:00", title: "ให้ยาหนมปังหลังอาหาร", detail: "เตือนซ้ำจนกว่าจะเสร็จ", tone: "peach", icon: "◉" },
      { time: "3 ต.ค.", title: "ชานม · นัดฉีดวัคซีน", detail: "คลินิกใกล้บ้าน 10:30", tone: "blue", icon: "📅" },
    ],
    rail: [
      { title: "สมาชิกขนฟู", value: "แมว 4", detail: "กระต่าย 1 ตัว", icon: "🐾" },
      { title: "นัดถัดไป", value: "3 ต.ค.", detail: "วัคซีนชานม 10:30", icon: "📆" },
      { title: "ค่าใช้จ่ายเดือนนี้", value: "฿2,340", detail: "อาหาร · ทราย · ยา", icon: "฿" },
    ],
  },
  family: {
    label: "ครอบครัว",
    icon: "⌂",
    cover: "/art/family-garden.webp",
    coverAlt: "ครอบครัวอยู่ร่วมกันในสวนของบ้านพร้อมสัตว์เลี้ยง",
    kicker: "บ้านของเรา · 2 สมาชิก",
    title: "ครอบครัวของเรา",
    subtitle: "เห็นว่าใครดูแลอะไร วันสำคัญ และเรื่องที่เกิดขึ้นในบ้าน",
    focusEyebrow: "ช่วงเวลาร่วมกัน",
    focusTitle: "มื้อเย็น 19:00",
    focusDetail: "วันนี้ทุกคนช่วยกันสำเร็จแล้ว 5 รายการ",
    focusItems: ["คุณ · 3 งาน", "สมาชิกอีกคน · 2 งาน", "งานร่วมกัน 71%"],
    metrics: [
      { label: "งานร่วมกัน", value: "5/7", detail: "สำเร็จแล้ว 71%", icon: "✓", tone: "sage" },
      { label: "วันสำคัญถัดไป", value: "12 วัน", detail: "วันเกิดสมาชิก", icon: "🎂", tone: "peach" },
      { label: "งบครอบครัว", value: "฿8,420", detail: "72% ของงบ", icon: "👛", tone: "gold" },
    ],
    timelineTitle: "กิจกรรมของครอบครัว",
    timeline: [
      { time: "08:12", title: "สมาชิกอีกคนรดน้ำต้นไม้", detail: "งานบ้านหมุนเวียน", tone: "sage", icon: "🌿" },
      { time: "09:46", title: "คุณบันทึกรายรับ +฿1.18", detail: "Cash Box", tone: "gold", icon: "฿" },
      { time: "11:20", title: "เพิ่มรายการซื้อของร่วมกัน", detail: "อาหารแมวและทิชชู่", tone: "blue", icon: "🛒" },
      { time: "17:30", title: "ซักผ้าเสร็จแล้ว", detail: "เหลืองานวันนี้อีก 1 รายการ", tone: "sage", icon: "✓" },
      { time: "19:00", title: "มื้อเย็นครอบครัว", detail: "กิจกรรมร่วมกัน · ที่บ้าน", tone: "peach", icon: "♡" },
    ],
    rail: [
      { title: "สมาชิกในบ้าน", value: "2 คน", detail: "คุณ · สมาชิกอีกคน", icon: "👥" },
      { title: "ประกาศในบ้าน", detail: "อาหารแมวใกล้หมด", icon: "📣" },
      { title: "สิ่งที่จะเกิดขึ้น", value: "3 รายการ", detail: "สัปดาห์นี้", icon: "📅" },
    ],
  },
};

const TONE_CLASS = {
  sage: "bg-[#e4eee0] text-[#4f6754]",
  peach: "bg-[#fde2d5] text-[#a85743]",
  blue: "bg-[#e1ebf1] text-[#4f748d]",
  gold: "bg-[#f7ead0] text-[#9a6f2d]",
};

function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[1.5rem] border border-white/70 bg-finance-surface-strong shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

export default function CozyHybridDesignPreview() {
  const [active, setActive] = useState<SectionKey>("home");
  const section = SECTIONS[active];

  return (
    <div className="-mx-4 -mt-2 min-w-0 pb-10 sm:px-2">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-4">
        <div className="sticky top-2 z-20 overflow-x-auto rounded-[1.25rem] border border-white/70 bg-finance-surface-strong/95 p-1.5 shadow-card backdrop-blur">
          <div className="flex min-w-max gap-1">
            {(Object.keys(SECTIONS) as SectionKey[]).map((key) => {
              const item = SECTIONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={`flex min-h-11 items-center gap-2 rounded-[1rem] px-4 text-sm font-semibold transition active:scale-[0.98] ${
                    active === key
                      ? "bg-finance-primary text-finance-primary-foreground"
                      : "text-finance-muted hover:bg-finance-primary-soft/45 hover:text-finance-text"
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
            <span className="ml-2 flex items-center rounded-full bg-[#fde2d5] px-3 text-xs font-semibold text-[#9a4e3b]">
              Preview · ยังไม่ขึ้น Production
            </span>
          </div>
        </div>

        <section className="relative min-h-52 overflow-hidden rounded-[1.75rem] bg-finance-surface-strong shadow-card sm:min-h-60 lg:min-h-64">
          <Image
            src={section.cover}
            alt={section.coverAlt}
            fill
            priority
            sizes="(min-width: 1024px) 90rem, 100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,250,242,0.98)_0%,rgba(255,250,242,0.9)_38%,rgba(255,250,242,0.48)_68%,rgba(255,250,242,0.08)_100%)]"
          />
          <div className="relative flex min-h-52 max-w-2xl flex-col justify-center p-6 sm:min-h-60 sm:p-8 lg:min-h-64">
            <p className="text-xs font-semibold text-finance-muted">{section.kicker}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-finance-text sm:text-4xl">
              {section.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-finance-muted sm:text-base">
              {section.subtitle}
            </p>
          </div>
        </section>

        <div className="grid min-w-0 gap-3 lg:grid-cols-12">
          <Surface className="flex min-h-56 flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,var(--finance-primary),var(--finance-primary-strong))] p-6 text-finance-primary-foreground lg:col-span-6">
            <div>
              <p className="text-xs font-semibold text-finance-primary-foreground/75">
                {section.focusEyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight">
                {section.focusTitle}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-finance-primary-foreground/80">
                {section.focusDetail}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {section.focusItems.map((item) => (
                <span
                  key={item}
                  className="rounded-[0.9rem] bg-white/15 px-3 py-2 text-sm font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </Surface>

          <div className="grid gap-3 sm:grid-cols-3 lg:col-span-6">
            {section.metrics.map((metric) => (
              <Surface key={metric.label} className="flex min-h-44 flex-col justify-between p-5">
                <span
                  className={`flex size-11 items-center justify-center rounded-2xl text-xl ${TONE_CLASS[metric.tone]}`}
                  aria-hidden="true"
                >
                  {metric.icon}
                </span>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-finance-muted">{metric.label}</p>
                  <p className="mt-1 text-xl font-semibold text-finance-text">{metric.value}</p>
                  <p className="mt-1 text-xs text-finance-muted">{metric.detail}</p>
                </div>
              </Surface>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-12">
          <Surface className="min-w-0 p-5 sm:p-6 lg:col-span-8">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-finance-muted">ไทม์ไลน์</p>
                <h2 className="mt-1 text-xl font-semibold text-finance-text">
                  {section.timelineTitle}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full bg-finance-primary-soft/55 px-3 py-2 text-xs font-semibold text-finance-primary-strong"
              >
                ดูทั้งหมด
              </button>
            </div>

            <div className="relative ml-2 space-y-3 pl-8 before:absolute before:bottom-4 before:left-[0.44rem] before:top-4 before:w-0.5 before:bg-finance-primary-soft">
              {section.timeline.map((item) => (
                <article
                  key={`${item.time}-${item.title}`}
                  className="relative rounded-[1.15rem] bg-finance-primary-soft/20 p-4"
                >
                  <span
                    className={`absolute -left-[2.05rem] top-5 flex size-4 items-center justify-center rounded-full ring-4 ring-finance-background ${TONE_CLASS[item.tone]}`}
                    aria-hidden="true"
                  />
                  <div className="grid gap-2 sm:grid-cols-[6rem_2.5rem_minmax(0,1fr)] sm:items-center">
                    <time className="text-xs font-semibold tabular-nums text-finance-muted">
                      {item.time}
                    </time>
                    <span
                      className={`flex size-9 items-center justify-center rounded-xl text-sm ${TONE_CLASS[item.tone]}`}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-finance-text">{item.title}</h3>
                      <p className="mt-0.5 text-xs text-finance-muted">{item.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Surface>

          <aside className="grid content-start gap-3 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1">
            {section.rail.map((item) => (
              <Surface key={item.title} className="p-5">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-finance-primary-soft/60 text-lg"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-finance-muted">{item.title}</p>
                    {item.value ? (
                      <p className="mt-1 text-xl font-semibold text-finance-text">{item.value}</p>
                    ) : null}
                    <p className="mt-1 text-sm leading-relaxed text-finance-muted">{item.detail}</p>
                  </div>
                </div>
              </Surface>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
