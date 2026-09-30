type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export async function syncAppBadge(unreadCount: number) {
  if (typeof navigator === "undefined") return;

  const badgeNavigator = navigator as BadgeNavigator;

  try {
    if (unreadCount > 0) {
      await badgeNavigator.setAppBadge?.(unreadCount);
      return;
    }

    if (badgeNavigator.clearAppBadge) {
      await badgeNavigator.clearAppBadge();
      return;
    }

    await badgeNavigator.setAppBadge?.(0);
  } catch {
    // Badging is best-effort and may be blocked by OS notification settings.
  }
}
