"use client";

import { useEffect } from "react";

import {
  parseTimeTheme,
  TIME_THEME_COLORS,
  timeThemeForBangkok,
} from "@/features/theme/time-theme";

function applyCurrentTimeTheme() {
  const theme =
    parseTimeTheme(
      new URLSearchParams(window.location.search).get("timeTheme"),
    ) ?? timeThemeForBangkok();
  const root = document.documentElement;
  root.dataset.timeTheme = theme;
  root.style.colorScheme = "light";

  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", TIME_THEME_COLORS[theme]);
}

export function TimeThemeController() {
  useEffect(() => {
    applyCurrentTimeTheme();

    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNextCheck = () => {
      const delay = 60_050 - (Date.now() % 60_000);
      timeoutId = setTimeout(() => {
        applyCurrentTimeTheme();
        scheduleNextCheck();
      }, delay);
    };

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") applyCurrentTimeTheme();
    };

    scheduleNextCheck();
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, []);

  return null;
}
