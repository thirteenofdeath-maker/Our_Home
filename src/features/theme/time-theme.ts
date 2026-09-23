const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export const TIME_THEMES = [
  "morning",
  "late-morning",
  "midday",
  "afternoon",
  "evening",
  "night",
  "late-night",
] as const;

export type TimeTheme = (typeof TIME_THEMES)[number];

export function timeThemeForHour(hour: number): TimeTheme {
  if (hour >= 5 && hour < 8) return "morning";
  if (hour >= 8 && hour < 11) return "late-morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  if (hour >= 20 && hour < 23) return "night";
  return "late-night";
}

export function timeThemeForBangkok(now = new Date()): TimeTheme {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: BANGKOK_TIME_ZONE,
    }).format(now),
  );

  return timeThemeForHour(hour);
}

export const TIME_THEME_COLORS: Record<TimeTheme, string> = {
  morning: "#607a65",
  "late-morning": "#6f7653",
  midday: "#7c6c4f",
  afternoon: "#7e6b4c",
  evening: "#715348",
  night: "#081c30",
  "late-night": "#061523",
};

export function isDarkTimeTheme(theme: TimeTheme) {
  return theme === "night" || theme === "late-night";
}
