/**
 * On-device notifications (react-native-notify-kit, a maintained
 * New-Architecture fork of Notifee).
 *
 * Everything here is scheduled locally with AlarmManager, so it fires even
 * if the app is closed or offline. The backend is only involved for the
 * optional WhatsApp side-channel on reminders.
 *
 * Notification bodies never contain Vault content.
 */
import notifee, {
  AndroidImportance,
  AndroidNotificationSetting,
  AndroidVisibility,
  AuthorizationStatus,
  TriggerType,
} from 'react-native-notify-kit';

const CHANNELS = {
  reminders: { id: 'reminders', name: 'Reminders', importance: AndroidImportance.HIGH },
  actions: { id: 'actions', name: 'Planned actions', importance: AndroidImportance.DEFAULT },
  streak: { id: 'streak', name: 'Streak warnings', importance: AndroidImportance.HIGH },
};

const ACTION_PREFIX = 'action-';
const STREAK_PREFIX = 'streak-risk-';
/** Local hour at which an unfinished day triggers a streak-at-risk warning. */
export const STREAK_WARNING_HOUR = 20;

let initPromise: Promise<void> | null = null;

/** Creates the Android channels and requests permission. Call once at app boot. */
export function initNotifications(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await notifee.requestPermission();
      for (const channel of Object.values(CHANNELS)) {
        await notifee.createChannel({ ...channel, visibility: AndroidVisibility.PUBLIC });
      }
    })();
  }
  return initPromise;
}

export async function hasNotificationPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

async function schedule(id: string, channelId: string, title: string, body: string, at: Date): Promise<void> {
  if (at.getTime() <= Date.now()) return;
  await notifee.createTriggerNotification(
    { id, title, body, android: { channelId, pressAction: { id: 'default' } } },
    { type: TriggerType.TIMESTAMP, timestamp: at.getTime(), alarmManager: true },
  );
}

// ---- Reminders -----------------------------------------------------------------

/** Schedules (or reschedules) a one-off notification for a reminder, keyed by its id. */
export async function scheduleReminderNotification(reminderId: string, title: string, body: string, at: Date): Promise<void> {
  await schedule(reminderId, CHANNELS.reminders.id, title, body, at);
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  await notifee.cancelTriggerNotification(reminderId);
}

// ---- Actions -------------------------------------------------------------------

export interface PlannedAction {
  id: string;
  title: string;
  trackName: string;
  dateKey: string; // YYYY-MM-DD
  timeOfDay: string; // HH:MM:SS
}

/** Replaces every scheduled action notification with this set. */
export async function syncActionNotifications(actions: PlannedAction[]): Promise<void> {
  const ids = await notifee.getTriggerNotificationIds();
  await Promise.all(ids.filter(id => id.startsWith(ACTION_PREFIX)).map(id => notifee.cancelTriggerNotification(id)));
  for (const a of actions) {
    const [y, m, d] = a.dateKey.split('-').map(Number);
    const [hh, mm] = a.timeOfDay.split(':').map(Number);
    await schedule(`${ACTION_PREFIX}${a.id}-${a.dateKey}`, CHANNELS.actions.id, a.title, `${a.trackName} · planned for now`, new Date(y, m - 1, d, hh, mm));
  }
}

// ---- Streak at risk -------------------------------------------------------------

/** Warns at STREAK_WARNING_HOUR if today isn't secured yet; clears the warning otherwise. */
export async function syncStreakWarning(opts: { dateKey: string; streak: number; remaining: number; enabled: boolean }): Promise<void> {
  const ids = await notifee.getTriggerNotificationIds();
  await Promise.all(ids.filter(id => id.startsWith(STREAK_PREFIX)).map(id => notifee.cancelTriggerNotification(id)));
  if (!opts.enabled || opts.remaining <= 0 || opts.streak <= 0) return;
  const [y, m, d] = opts.dateKey.split('-').map(Number);
  const at = new Date(y, m - 1, d, STREAK_WARNING_HOUR, 0);
  const plural = opts.remaining === 1 ? 'action' : 'actions';
  await schedule(
    `${STREAK_PREFIX}${opts.dateKey}`,
    CHANNELS.streak.id,
    `Your ${opts.streak}-day streak is at risk`,
    `${opts.remaining} ${plural} left today. You've got this.`,
    at,
  );
}

// ---- Housekeeping ---------------------------------------------------------------

/** Clears every scheduled and shown notification (used on logout). */
export async function cancelAllScheduled(): Promise<void> {
  await notifee.cancelAllNotifications();
}

/**
 * On Android 12+, exact-time delivery needs the "Alarms & reminders" special
 * permission; without it notifications still fire, just possibly late.
 */
export async function hasExactAlarmPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.android?.alarm !== AndroidNotificationSetting.DISABLED;
}

export function openExactAlarmSettings(): Promise<void> {
  return notifee.openAlarmPermissionSettings();
}
