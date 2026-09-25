import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/* eslint-disable @typescript-eslint/no-explicit-any -- Edge Function queries span
   several nested PostgREST relations and intentionally stay independent from
   the Next.js app's generated Database type. */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import {
  birthdayOccurrence,
  memberBirthdayRecipients,
  petBirthdayRecipients,
  petCareRecipients,
} from "./birthday.ts";
import {
  addDigestCount,
  addDigestDetail,
  birthdayFallsInWindow,
  digestBody,
  type DigestCounts,
  type DigestDetails,
} from "./digest.ts";
import { notificationPreferenceAllows } from "./preferences.ts";

type Candidate = {
  sourceType:
    | "REMINDER"
    | "TASK"
    | "EVENT"
    | "PET"
    | "BILL"
    | "CARD"
    | "MEMBER_BIRTHDAY"
    | "PET_BIRTHDAY"
    | "DAILY_DIGEST"
    | "WEEKLY_DIGEST"
    | "INVENTORY"
    | "TEST";
  sourceId: string;
  occurrenceKey: string;
  kind:
    "AT_TIME" | "WEEK_BEFORE" | "DAY_BEFORE" | "DUE_DAY" | "DIGEST" | "TEST";
  category: "plan" | "pets" | "finance" | "inventory";
  preferenceKey?:
    | "member_birthdays_enabled"
    | "pet_birthdays_enabled"
    | "daily_digest_enabled"
    | "weekly_digest_enabled"
    | "inventory_enabled";
  title: string;
  body: string;
  url: string;
  scheduledFor: string;
  users: string[];
};

const jsonHeaders = { "Content-Type": "application/json" };
const BANGKOK = "Asia/Bangkok";

function localParts(date = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BANGKOK,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nearNow(value: string, now: Date, minutes = 6) {
  return (
    Math.abs(now.getTime() - new Date(value).getTime()) <= minutes * 60_000
  );
}

function householdUsers(
  map: Map<string, string[]>,
  householdId: string | null,
) {
  return householdId ? (map.get(householdId) ?? []) : [];
}

function recipients(
  scope: string,
  creator: string,
  householdId: string | null,
  members: Map<string, string[]>,
) {
  return scope === "PERSONAL"
    ? [creator]
    : householdUsers(members, householdId);
}

async function digestCandidates(
  admin: any,
  now: Date,
  memberRows: any[],
): Promise<Candidate[]> {
  const local = localParts(now);
  const weekday = new Date(`${local.date}T12:00:00Z`).getUTCDay();
  const daily = local.hour === 7 && local.minute <= 9;
  const weekly = weekday === 0 && local.hour === 18 && local.minute <= 9;
  if (!daily && !weekly) return [];

  const period = daily ? "DAILY" : "WEEKLY";
  const startDate = daily ? local.date : shiftDate(local.date, 1);
  const endDate = daily ? local.date : shiftDate(startDate, 6);
  const startIso = new Date(`${startDate}T00:00:00+07:00`).toISOString();
  const endIso = new Date(
    `${shiftDate(endDate, 1)}T00:00:00+07:00`,
  ).toISOString();
  const [
    tasksResult,
    remindersResult,
    allDayEventsResult,
    timedEventsResult,
    choresResult,
    petCareResult,
    billsResult,
    statementsResult,
    profilesResult,
    petsResult,
    inventoryResult,
  ] = await Promise.all([
    admin
      .from("plan_tasks")
      .select("created_by,scope,household_id")
      .is("archived_at", null)
      .eq("is_completed", false)
      .gte("due_date", startDate)
      .lte("due_date", endDate),
    admin
      .from("plan_reminders")
      .select("created_by,scope,household_id")
      .is("archived_at", null)
      .eq("is_completed", false)
      .gte("reminds_at", startIso)
      .lt("reminds_at", endIso),
    admin
      .from("calendar_events")
      .select("created_by,scope,household_id")
      .is("archived_at", null)
      .eq("is_all_day", true)
      .gte("all_day_date", startDate)
      .lte("all_day_date", endDate),
    admin
      .from("calendar_events")
      .select("created_by,scope,household_id")
      .is("archived_at", null)
      .eq("is_all_day", false)
      .gte("starts_at", startIso)
      .lt("starts_at", endIso),
    admin
      .from("chore_occurrences")
      .select("assigned_member_id")
      .is("completed_at", null)
      .gte("due_date", startDate)
      .lte("due_date", endDate),
    admin
      .from("pet_care_records")
      .select("household_id,pets(pet_caregivers(household_member_id))")
      .is("archived_at", null)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso),
    admin
      .from("bill_occurrences")
      .select("bills(scope,owner_user_id,household_id)")
      .eq("status", "OPEN")
      .gte("due_date", startDate)
      .lte("due_date", endDate),
    admin
      .from("credit_card_statements")
      .select("credit_card_accounts(wallets(scope,owner_user_id,household_id))")
      .gt("statement_balance", 0)
      .gte("due_date", startDate)
      .lte("due_date", endDate),
    admin
      .from("profiles")
      .select("id,birthday,share_birthday_with_household")
      .eq("share_birthday_with_household", true)
      .not("birthday", "is", null),
    admin
      .from("pets")
      .select("id,household_id,birthday,pet_caregivers(household_member_id)")
      .is("archived_at", null)
      .not("birthday", "is", null),
    admin
      .from("inventory_items")
      .select(
        "household_id,name,quantity,restock_threshold,expiry_date,warranty_expires_on",
      )
      .is("archived_at", null),
  ]);
  const results = [
    tasksResult,
    remindersResult,
    allDayEventsResult,
    timedEventsResult,
    choresResult,
    petCareResult,
    billsResult,
    statementsResult,
    profilesResult,
    petsResult,
    inventoryResult,
  ];
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const usersByHousehold = new Map<string, string[]>();
  const userByMember = new Map<string, string>();
  for (const member of memberRows) {
    usersByHousehold.set(member.household_id, [
      ...(usersByHousehold.get(member.household_id) ?? []),
      member.user_id,
    ]);
    userByMember.set(member.id, member.user_id);
  }
  const itemUsers = (row: any) =>
    row.scope === "PERSONAL"
      ? [row.created_by]
      : (usersByHousehold.get(row.household_id) ?? []);
  const counts = new Map<string, DigestCounts>();
  const details = new Map<string, DigestDetails>();
  for (const row of tasksResult.data ?? [])
    addDigestCount(counts, itemUsers(row), "tasks");
  for (const row of remindersResult.data ?? [])
    addDigestCount(counts, itemUsers(row), "tasks");
  for (const row of [
    ...(allDayEventsResult.data ?? []),
    ...(timedEventsResult.data ?? []),
  ])
    addDigestCount(counts, itemUsers(row), "appointments");
  for (const row of choresResult.data ?? []) {
    const userId = userByMember.get(row.assigned_member_id);
    if (userId) addDigestCount(counts, [userId], "tasks");
  }
  for (const row of petCareResult.data ?? []) {
    const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    const caregivers = (pet?.pet_caregivers ?? []).map(
      (caregiver: any) => caregiver.household_member_id,
    );
    addDigestCount(
      counts,
      petCareRecipients(memberRows, row.household_id, caregivers),
      "pets",
    );
  }
  for (const row of billsResult.data ?? []) {
    const bill = Array.isArray(row.bills) ? row.bills[0] : row.bills;
    if (bill)
      addDigestCount(
        counts,
        bill.scope === "PERSONAL"
          ? [bill.owner_user_id]
          : (usersByHousehold.get(bill.household_id) ?? []),
        "bills",
      );
  }
  for (const row of statementsResult.data ?? []) {
    const card = Array.isArray(row.credit_card_accounts)
      ? row.credit_card_accounts[0]
      : row.credit_card_accounts;
    const wallet = Array.isArray(card?.wallets)
      ? card.wallets[0]
      : card?.wallets;
    if (wallet)
      addDigestCount(
        counts,
        wallet.scope === "PERSONAL"
          ? [wallet.owner_user_id]
          : (usersByHousehold.get(wallet.household_id) ?? []),
        "bills",
      );
  }
  for (const row of profilesResult.data ?? []) {
    if (!birthdayFallsInWindow(row.birthday, startDate, endDate)) continue;
    addDigestCount(
      counts,
      memberBirthdayRecipients(memberRows, row.id),
      "birthdays",
    );
  }
  for (const row of petsResult.data ?? []) {
    if (!birthdayFallsInWindow(row.birthday, startDate, endDate)) continue;
    addDigestCount(
      counts,
      petBirthdayRecipients(
        memberRows,
        row.household_id,
        (row.pet_caregivers ?? []).map(
          (caregiver: any) => caregiver.household_member_id,
        ),
      ),
      "birthdays",
    );
  }
  for (const row of inventoryResult.data ?? []) {
    const low =
      row.restock_threshold !== null &&
      Number(row.quantity) <= Number(row.restock_threshold);
    const expiryInWindow =
      row.expiry_date &&
      row.expiry_date >= startDate &&
      row.expiry_date <= endDate;
    const warrantyInWindow =
      row.warranty_expires_on &&
      row.warranty_expires_on >= startDate &&
      row.warranty_expires_on <= endDate;
    if (!low && !expiryInWindow && !warrantyInWindow) continue;
    const users = usersByHousehold.get(row.household_id) ?? [];
    addDigestCount(counts, users, "inventory");
    const reasons = [
      low ? "ใกล้หมด" : null,
      expiryInWindow
        ? row.expiry_date === startDate
          ? "หมดอายุวันนี้"
          : "ใกล้หมดอายุ"
        : null,
      warrantyInWindow
        ? row.warranty_expires_on === startDate
          ? "ประกันสิ้นสุดวันนี้"
          : "ประกันใกล้สิ้นสุด"
        : null,
    ].filter(Boolean);
    addDigestDetail(
      details,
      users,
      "inventory",
      `${row.name} ${reasons.join(" · ")}`,
    );
  }

  return [...counts.entries()].map(([userId, userCounts]) => ({
    sourceType: daily ? "DAILY_DIGEST" : "WEEKLY_DIGEST",
    sourceId: userId,
    occurrenceKey: `${startDate}:${endDate}`,
    kind: "DIGEST",
    category: "plan",
    preferenceKey: daily ? "daily_digest_enabled" : "weekly_digest_enabled",
    title: daily ? "สรุปบ้านวันนี้" : "สรุปบ้านสัปดาห์หน้า",
    body: digestBody(userCounts, period, details.get(userId)),
    url: "/",
    scheduledFor: now.toISOString(),
    users: [userId],
  }));
}

function reminderOccursNow(reminder: any, now: Date) {
  if (reminder.recurrence === "NONE") {
    const age = now.getTime() - new Date(reminder.reminds_at).getTime();
    return age >= 0 && age <= 6 * 60_000;
  }
  const current = localParts(now);
  const start = localParts(new Date(reminder.reminds_at));
  const minuteAge =
    current.hour * 60 + current.minute - (start.hour * 60 + start.minute);
  if (current.date < start.date || minuteAge < 0 || minuteAge > 5) return false;
  const currentDate = new Date(`${current.date}T00:00:00Z`);
  const startDate = new Date(`${start.date}T00:00:00Z`);
  if (reminder.recurrence === "DAILY") return true;
  if (reminder.recurrence === "WEEKLY")
    return currentDate.getUTCDay() === startDate.getUTCDay();
  if (reminder.recurrence === "MONTHLY")
    return currentDate.getUTCDate() === startDate.getUTCDate();
  return (
    currentDate.getUTCMonth() === startDate.getUTCMonth() &&
    currentDate.getUTCDate() === startDate.getUTCDate()
  );
}

async function scheduledCandidates(
  admin: any,
  now: Date,
): Promise<Candidate[]> {
  const local = localParts(now);
  const tomorrow = shiftDate(local.date, 1);
  const yesterday = shiftDate(local.date, -1);
  const atMorning = local.hour === 9 && local.minute <= 9;
  const weekAhead = shiftDate(local.date, 7);
  const [
    membersResult,
    remindersResult,
    tasksResult,
    eventsResult,
    petResult,
    billsResult,
    statementsResult,
    birthdayProfilesResult,
    birthdayPetsResult,
    inventoryResult,
  ] = await Promise.all([
    admin.from("household_members").select("id,household_id,user_id,role"),
    admin
      .from("plan_reminders")
      .select("id,household_id,created_by,scope,title,reminds_at,recurrence")
      .is("archived_at", null)
      .eq("is_completed", false),
    admin
      .from("plan_tasks")
      .select("id,household_id,created_by,scope,title,due_date,due_time")
      .is("archived_at", null)
      .eq("is_completed", false)
      .eq("due_date", local.date),
    admin
      .from("calendar_events")
      .select(
        "id,household_id,created_by,scope,title,starts_at,is_all_day,all_day_date",
      )
      .is("archived_at", null)
      .or(
        `and(is_all_day.eq.true,all_day_date.eq.${local.date}),and(is_all_day.eq.false,starts_at.gte.${new Date(now.getTime() - 6 * 60_000).toISOString()},starts_at.lte.${new Date(now.getTime() + 6 * 60_000).toISOString()})`,
      ),
    atMorning
      ? admin
          .from("pet_care_records")
          .select(
            "id,pet_id,household_id,title,scheduled_at,pets(name,pet_caregivers(household_member_id))",
          )
          .is("archived_at", null)
          .gte("scheduled_at", `${yesterday}T17:00:00Z`)
          .lt("scheduled_at", `${tomorrow}T17:00:00Z`)
      : Promise.resolve({ data: [], error: null }),
    atMorning
      ? admin
          .from("bill_occurrences")
          .select(
            "id,due_date,expected_amount,bill_id,bills(name,scope,owner_user_id,household_id)",
          )
          .eq("status", "OPEN")
          .in("due_date", [local.date, tomorrow])
      : Promise.resolve({ data: [], error: null }),
    atMorning
      ? admin
          .from("credit_card_statements")
          .select(
            "id,card_account_id,due_date,statement_balance,credit_card_accounts(wallet_id,issuer,last_four,wallets(name,scope,owner_user_id,household_id))",
          )
          .in("due_date", [local.date, tomorrow])
          .gt("statement_balance", 0)
      : Promise.resolve({ data: [], error: null }),
    atMorning
      ? admin
          .from("profiles")
          .select("id,display_name,birthday,share_birthday_with_household")
          .eq("share_birthday_with_household", true)
          .not("birthday", "is", null)
      : Promise.resolve({ data: [], error: null }),
    atMorning
      ? admin
          .from("pets")
          .select(
            "id,household_id,name,birthday,pet_caregivers(household_member_id)",
          )
          .is("archived_at", null)
          .not("birthday", "is", null)
      : Promise.resolve({ data: [], error: null }),
    atMorning
      ? admin
          .from("inventory_items")
          .select(
            "id,household_id,name,quantity,unit,restock_threshold,expiry_date,warranty_expires_on,updated_at",
          )
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = [
    membersResult,
    remindersResult,
    tasksResult,
    eventsResult,
    petResult,
    billsResult,
    statementsResult,
    birthdayProfilesResult,
    birthdayPetsResult,
    inventoryResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const members = new Map<string, string[]>();
  const memberRows = membersResult.data ?? [];
  for (const row of memberRows)
    members.set(row.household_id, [
      ...(members.get(row.household_id) ?? []),
      row.user_id,
    ]);
  const candidates: Candidate[] = [];

  for (const row of inventoryResult.data ?? []) {
    const users = householdUsers(members, row.household_id);
    const alerts: Array<{ key: string; date: string; label: string }> = [];
    if (
      row.expiry_date &&
      [local.date, tomorrow, weekAhead].includes(row.expiry_date)
    )
      alerts.push({ key: "expiry", date: row.expiry_date, label: "หมดอายุ" });
    if (
      row.warranty_expires_on &&
      [local.date, tomorrow, weekAhead].includes(row.warranty_expires_on)
    )
      alerts.push({
        key: "warranty",
        date: row.warranty_expires_on,
        label: "ประกันสิ้นสุด",
      });
    for (const alert of alerts) {
      const kind =
        alert.date === local.date
          ? "DUE_DAY"
          : alert.date === tomorrow
            ? "DAY_BEFORE"
            : "WEEK_BEFORE";
      candidates.push({
        sourceType: "INVENTORY",
        sourceId: row.id,
        occurrenceKey: `${alert.key}:${alert.date}`,
        kind,
        category: "inventory",
        preferenceKey: "inventory_enabled",
        title:
          kind === "DUE_DAY"
            ? `${row.name} ${alert.label}วันนี้`
            : kind === "DAY_BEFORE"
              ? `${row.name} ${alert.label}พรุ่งนี้`
              : `${row.name} ${alert.label}ใน 7 วัน`,
        body: "เปิดคลังของในบ้านเพื่อดูรายละเอียด",
        url: `/inventory/${row.id}`,
        scheduledFor: now.toISOString(),
        users,
      });
    }
    if (
      row.restock_threshold !== null &&
      Number(row.quantity) <= Number(row.restock_threshold)
    ) {
      candidates.push({
        sourceType: "INVENTORY",
        sourceId: row.id,
        occurrenceKey: `low:${row.quantity}:${row.updated_at}`,
        kind: "DUE_DAY",
        category: "inventory",
        preferenceKey: "inventory_enabled",
        title: `${row.name} ใกล้หมด`,
        body: `เหลือ ${row.quantity}${row.unit ? ` ${row.unit}` : ""} · แตะเพื่อส่งไปรายการซื้อ`,
        url: `/inventory/${row.id}`,
        scheduledFor: now.toISOString(),
        users,
      });
    }
  }

  // Birthday data stays behind service-role access. Recipients receive only a
  // display name and the upcoming month/day, never the birth year.
  for (const row of birthdayProfilesResult.data ?? []) {
    const occurrence = birthdayOccurrence(row.birthday, local.date);
    if (!occurrence) continue;
    const users = memberBirthdayRecipients(memberRows, row.id);
    if (!users.length) continue;
    candidates.push({
      sourceType: "MEMBER_BIRTHDAY",
      sourceId: row.id,
      occurrenceKey: occurrence.occurrenceDate,
      kind: occurrence.kind,
      category: "plan",
      preferenceKey: "member_birthdays_enabled",
      title:
        occurrence.kind === "DUE_DAY"
          ? `วันนี้วันเกิด ${row.display_name} 🎉`
          : occurrence.kind === "DAY_BEFORE"
            ? `พรุ่งนี้วันเกิด ${row.display_name}`
            : `อีก 7 วัน วันเกิด ${row.display_name}`,
      body: "เตรียมคำอวยพรหรือกิจกรรมเล็ก ๆ ให้คนในบ้าน",
      url: "/household",
      scheduledFor: now.toISOString(),
      users,
    });
  }

  for (const row of birthdayPetsResult.data ?? []) {
    const occurrence = birthdayOccurrence(row.birthday, local.date);
    if (!occurrence) continue;
    const users = petBirthdayRecipients(
      memberRows,
      row.household_id,
      (row.pet_caregivers ?? []).map(
        (caregiver: any) => caregiver.household_member_id,
      ),
    );
    if (!users.length) continue;
    candidates.push({
      sourceType: "PET_BIRTHDAY",
      sourceId: row.id,
      occurrenceKey: occurrence.occurrenceDate,
      kind: occurrence.kind,
      category: "pets",
      preferenceKey: "pet_birthdays_enabled",
      title:
        occurrence.kind === "DUE_DAY"
          ? `วันนี้วันเกิด ${row.name} 🐾`
          : occurrence.kind === "DAY_BEFORE"
            ? `พรุ่งนี้วันเกิด ${row.name}`
            : `อีก 7 วัน วันเกิด ${row.name}`,
      body: "เตรียมฉลองให้สมาชิกตัวน้อยของบ้าน",
      url: `/pets/${row.id}`,
      scheduledFor: now.toISOString(),
      users,
    });
  }

  for (const row of remindersResult.data ?? [])
    if (reminderOccursNow(row, now))
      candidates.push({
        sourceType: "REMINDER",
        sourceId: row.id,
        occurrenceKey: local.date,
        kind: "AT_TIME",
        category: "plan",
        title: "รายการเตือน",
        body: row.title,
        url: `/calendar/reminders/${row.id}`,
        scheduledFor: now.toISOString(),
        users: recipients(row.scope, row.created_by, row.household_id, members),
      });
  for (const row of tasksResult.data ?? []) {
    const taskTime = row.due_time ? row.due_time.slice(0, 5) : "09:00";
    if (
      taskTime ===
        `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}` ||
      (!row.due_time && atMorning)
    )
      candidates.push({
        sourceType: "TASK",
        sourceId: row.id,
        occurrenceKey: row.due_date,
        kind: "AT_TIME",
        category: "plan",
        title: "งานที่ถึงกำหนด",
        body: row.title,
        url: `/calendar/tasks/${row.id}`,
        scheduledFor: now.toISOString(),
        users: recipients(row.scope, row.created_by, row.household_id, members),
      });
  }
  for (const row of eventsResult.data ?? [])
    if (
      (row.is_all_day && atMorning) ||
      (!row.is_all_day && nearNow(row.starts_at, now))
    )
      candidates.push({
        sourceType: "EVENT",
        sourceId: row.id,
        occurrenceKey: row.is_all_day ? row.all_day_date : row.starts_at,
        kind: "AT_TIME",
        category: "plan",
        title: row.is_all_day ? "กิจกรรมวันนี้" : "กิจกรรมกำลังจะเริ่ม",
        body: row.title,
        url: `/calendar/${row.id}`,
        scheduledFor: now.toISOString(),
        users: recipients(row.scope, row.created_by, row.household_id, members),
      });
  for (const row of petResult.data ?? []) {
    const due = localParts(new Date(row.scheduled_at)).date;
    const kind =
      due === local.date ? "DUE_DAY" : due === tomorrow ? "DAY_BEFORE" : null;
    if (!kind) continue;
    const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    const caregiverMemberIds = (pet?.pet_caregivers ?? []).map(
      (caregiver: any) => caregiver.household_member_id,
    );
    const users = petCareRecipients(
      memberRows,
      row.household_id,
      caregiverMemberIds,
    );
    if (!users.length) continue;
    candidates.push({
      sourceType: "PET",
      sourceId: row.id,
      occurrenceKey: due,
      kind,
      category: "pets",
      title:
        kind === "DAY_BEFORE"
          ? "พรุ่งนี้มีตารางดูแลสัตว์เลี้ยง"
          : "ตารางดูแลสัตว์เลี้ยงวันนี้",
      body: `${pet?.name ?? "สัตว์เลี้ยง"} · ${row.title}`,
      url: `/pets/${row.pet_id}`,
      scheduledFor: now.toISOString(),
      users,
    });
  }
  for (const row of billsResult.data ?? []) {
    const bill = Array.isArray(row.bills) ? row.bills[0] : row.bills;
    if (!bill) continue;
    const kind = row.due_date === local.date ? "DUE_DAY" : "DAY_BEFORE";
    candidates.push({
      sourceType: "BILL",
      sourceId: row.id,
      occurrenceKey: row.due_date,
      kind,
      category: "finance",
      title:
        kind === "DAY_BEFORE" ? "บิลครบกำหนดพรุ่งนี้" : "บิลครบกำหนดวันนี้",
      body: bill.name,
      url: `/finance/bills/occurrences/${row.id}`,
      scheduledFor: now.toISOString(),
      users:
        bill.scope === "PERSONAL"
          ? [bill.owner_user_id]
          : householdUsers(members, bill.household_id),
    });
  }

  const statementIds = (statementsResult.data ?? []).map((row: any) => row.id);
  const [allocationResult, resolutionResult] = statementIds.length
    ? await Promise.all([
        admin
          .from("credit_card_statement_allocations")
          .select(
            "statement_id,amount,credit_card_liability_events(transactions(deleted_at))",
          )
          .in("statement_id", statementIds),
        admin
          .from("credit_card_statement_resolutions")
          .select("statement_id")
          .in("statement_id", statementIds),
      ])
    : [{ data: [] }, { data: [] }];
  const allocations = allocationResult.data ?? [];
  const resolved = new Set(
    (resolutionResult.data ?? []).map(
      (row: { statement_id: string }) => row.statement_id,
    ),
  );
  const paid = new Map<string, number>();
  for (const row of allocations) {
    const event = Array.isArray(row.credit_card_liability_events)
      ? row.credit_card_liability_events[0]
      : row.credit_card_liability_events;
    const transaction = Array.isArray(event?.transactions)
      ? event.transactions[0]
      : event?.transactions;
    if (!transaction?.deleted_at)
      paid.set(
        row.statement_id,
        (paid.get(row.statement_id) ?? 0) + Number(row.amount),
      );
  }
  for (const row of statementsResult.data ?? []) {
    if (
      resolved.has(row.id) ||
      Number(row.statement_balance) - (paid.get(row.id) ?? 0) <= 0
    )
      continue;
    const card = Array.isArray(row.credit_card_accounts)
      ? row.credit_card_accounts[0]
      : row.credit_card_accounts;
    const wallet = Array.isArray(card?.wallets)
      ? card.wallets[0]
      : card?.wallets;
    if (!wallet) continue;
    const kind = row.due_date === local.date ? "DUE_DAY" : "DAY_BEFORE";
    candidates.push({
      sourceType: "CARD",
      sourceId: row.id,
      occurrenceKey: row.due_date,
      kind,
      category: "finance",
      title:
        kind === "DAY_BEFORE"
          ? "ยอดบัตรครบกำหนดพรุ่งนี้"
          : "ยอดบัตรครบกำหนดวันนี้",
      body: wallet.name,
      url: `/wallets/${card.wallet_id}`,
      scheduledFor: now.toISOString(),
      users:
        wallet.scope === "PERSONAL"
          ? [wallet.owner_user_id]
          : householdUsers(members, wallet.household_id),
    });
  }
  candidates.push(...(await digestCandidates(admin, now, memberRows)));
  return candidates;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const body = await request.json().catch(() => ({}));
  const { data: config } = await admin
    .from("push_public_config")
    .select("vapid_public_key,vapid_subject")
    .eq("id", true)
    .single();
  const { data: secretRows } = await admin.rpc("get_push_server_secrets");
  const secrets = secretRows?.[0];
  if (!config || !secrets?.vapid_private_key)
    return new Response(JSON.stringify({ error: "Push is not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  webpush.setVapidDetails(
    config.vapid_subject,
    config.vapid_public_key,
    secrets.vapid_private_key,
  );

  let candidates: Candidate[];
  if (body.mode === "test") {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    if (!user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    candidates = [
      {
        sourceType: "TEST",
        sourceId: crypto.randomUUID(),
        occurrenceKey: new Date().toISOString(),
        kind: "TEST",
        category: "plan",
        title: "Our Home พร้อมแจ้งเตือนแล้ว",
        body: "นายจะไม่พลาดงาน นัดหมาย และวันครบกำหนดสำคัญ",
        url: "/",
        scheduledFor: new Date().toISOString(),
        users: [user.id],
      },
    ];
  } else {
    if (
      !secrets.cron_secret ||
      request.headers.get("x-cron-secret") !== secrets.cron_secret
    )
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    candidates = await scheduledCandidates(admin, new Date());
  }

  const userIds = [
    ...new Set(
      candidates.flatMap((candidate) => candidate.users).filter(Boolean),
    ),
  ];
  const [{ data: subscriptions }, { data: preferences }] = await Promise.all([
    userIds.length
      ? admin
          .from("push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth_key")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin
          .from("notification_preferences")
          .select("*")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);
  const prefs = new Map(
    (preferences ?? []).map((row: any) => [row.user_id, row]),
  );
  let sent = 0;
  for (const candidate of candidates)
    for (const subscription of subscriptions ?? []) {
      if (!candidate.users.includes(subscription.user_id)) continue;
      const preference: any = prefs.get(subscription.user_id) ?? {
        plan_enabled: true,
        pets_enabled: true,
        finance_enabled: true,
        inventory_enabled: true,
        member_birthdays_enabled: true,
        pet_birthdays_enabled: true,
        birthday_week_before_enabled: true,
        day_before_enabled: true,
        due_day_enabled: true,
        digest_mode_enabled: true,
        daily_digest_enabled: true,
        weekly_digest_enabled: true,
      };
      const isDigest =
        candidate.sourceType === "DAILY_DIGEST" ||
        candidate.sourceType === "WEEKLY_DIGEST";
      if (
        candidate.sourceType !== "TEST" &&
        (preference.digest_mode_enabled ? !isDigest : isDigest)
      )
        continue;
      if (!notificationPreferenceAllows(candidate, preference)) continue;
      const { data: deliveryId } = await admin.rpc(
        "claim_notification_delivery",
        {
          p_user_id: subscription.user_id,
          p_subscription_id: subscription.id,
          p_source_type: candidate.sourceType,
          p_source_id: candidate.sourceId,
          p_occurrence_key: candidate.occurrenceKey,
          p_notification_kind: candidate.kind,
          p_scheduled_for: candidate.scheduledFor,
        },
      );
      if (!deliveryId) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          },
          JSON.stringify({
            title: candidate.title,
            body: candidate.body,
            url: candidate.url,
            tag: `${candidate.sourceType}-${candidate.sourceId}-${candidate.kind}`,
          }),
        );
        await admin
          .from("notification_deliveries")
          .update({
            status: "SENT",
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq("id", deliveryId);
        sent++;
      } catch (error: any) {
        await admin
          .from("notification_deliveries")
          .update({
            status: "FAILED",
            error: String(error?.message ?? error).slice(0, 2000),
          })
          .eq("id", deliveryId);
        if (error?.statusCode === 404 || error?.statusCode === 410)
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
      }
    }
  return new Response(JSON.stringify({ candidates: candidates.length, sent }), {
    headers: jsonHeaders,
  });
});
