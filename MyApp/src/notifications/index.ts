/**
 * On-device notifications (react-native-notify-kit, a maintained
 * New-Architecture fork of Notifee).
 *
 * Everything here is scheduled locally with AlarmManager, so it fires even
 * if the app is closed or offline. The backend is only involved for the
 * optional WhatsApp side-channel on reminders.
 *
 * A reminder with the alarm option rings like an alarm clock instead: a
 * full-screen alert with a looping sound and a Stop button, for the number
 * of seconds chosen in Settings. Alarm sounds live in
 * android/app/src/main/res/raw; iOS uses its default sound.
 *
 * Notification bodies never contain Vault content.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidNotificationSetting,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Event,
  type Notification,
} from 'react-native-notify-kit';
import { formatClock } from '../utils/date';

const CHANNELS = {
  reminders: { id: 'reminders', name: 'Reminders', importance: AndroidImportance.HIGH },
  actions: { id: 'actions', name: 'Tasks', importance: AndroidImportance.DEFAULT },
  streak: { id: 'streak', name: 'Streak warnings', importance: AndroidImportance.HIGH },
};

// ---- Alarm sounds ------------------------------------------------------------------

/** The bundled alarm sounds (file names in res/raw, without extension). */
export const ALARM_SOUNDS = [
  { id: 'alarm_classic', label: 'Classic' },
  { id: 'alarm_chime', label: 'Chime' },
  { id: 'alarm_digital', label: 'Digital' },
  { id: 'alarm_gentle', label: 'Gentle' },
] as const;
export type AlarmSound = (typeof ALARM_SOUNDS)[number]['id'];

/** How long an alarm rings before it stops by itself. */
export const ALARM_LENGTHS = [10, 30, 60] as const;

export interface AlarmPreferences {
  sound: AlarmSound;
  seconds: number;
}

const ALARM_STORAGE_KEY = '@memo/alarm_preferences';
const DEFAULT_ALARM: AlarmPreferences = { sound: 'alarm_classic', seconds: 30 };
let alarmPrefs: AlarmPreferences = DEFAULT_ALARM;

/**
 * Android fixes a channel's sound when it is created, so each sound has its
 * own channel. The version is in the id because a channel made before its
 * sound file was installed keeps the default sound forever; bumping it makes
 * fresh channels (and initNotifications deletes the old ones).
 */
const ALARM_CHANNEL_PREFIX = 'memo-alarm-v2-';
const alarmChannelId = (sound: AlarmSound) => `${ALARM_CHANNEL_PREFIX}${sound}`;
const STOP_ACTION = 'stop-alarm';

/** Reads this device's alarm sound and length (they are per device, like a ringtone). */
export async function loadAlarmPreferences(): Promise<AlarmPreferences> {
  try {
    const raw = await AsyncStorage.getItem(ALARM_STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<AlarmPreferences>) : {};
    alarmPrefs = {
      sound: ALARM_SOUNDS.some(x => x.id === saved.sound) ? (saved.sound as AlarmSound) : DEFAULT_ALARM.sound,
      seconds: typeof saved.seconds === 'number' ? saved.seconds : DEFAULT_ALARM.seconds,
    };
  } catch {
    alarmPrefs = DEFAULT_ALARM;
  }
  return alarmPrefs;
}

export async function saveAlarmPreferences(prefs: AlarmPreferences): Promise<void> {
  alarmPrefs = prefs;
  await AsyncStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(prefs));
}

/** The Android part of an alarm: rings in a loop, shows full screen, stops itself. */
function alarmAndroid(prefs: AlarmPreferences) {
  return {
    channelId: alarmChannelId(prefs.sound),
    category: AndroidCategory.ALARM,
    importance: AndroidImportance.HIGH,
    sound: prefs.sound,
    loopSound: true,
    ongoing: true,
    autoCancel: false,
    lightUpScreen: true,
    timeoutAfter: prefs.seconds * 1000,
    fullScreenAction: { id: 'default' },
    actions: [{ title: 'Stop', pressAction: { id: STOP_ACTION } }],
  };
}

/** Rings an alarm right now with these settings, so the user can hear it in Settings. */
export async function testAlarm(prefs: AlarmPreferences): Promise<void> {
  await initNotifications();
  await notifee.displayNotification({
    id: 'alarm-test',
    title: 'Alarm test',
    body: `${ALARM_SOUNDS.find(x => x.id === prefs.sound)?.label ?? 'Alarm'} · rings for ${prefs.seconds} seconds`,
    android: { ...alarmAndroid(prefs), smallIcon: 'ic_notification', color: NOTIFICATION_TINT, largeIcon: 'ic_launcher', pressAction: { id: 'default' } },
    ios: { sound: 'default' },
  });
}

function isAlarm(notification: Notification | undefined) {
  return Boolean(notification?.android?.channelId?.startsWith(ALARM_CHANNEL_PREFIX));
}

/**
 * Stops a ringing alarm when Stop is pressed or the alarm is opened. Wired to
 * both the background and the foreground event streams.
 */
export async function handleNotificationEvent({ type, detail }: Event): Promise<void> {
  const n = detail.notification;
  if (!n?.id || !isAlarm(n)) return;
  if ((type === EventType.ACTION_PRESS && detail.pressAction?.id === STOP_ACTION) || type === EventType.PRESS) {
    await notifee.cancelNotification(n.id);
  }
}

export function subscribeToNotificationEvents(): () => void {
  return notifee.onForegroundEvent(event => {
    handleNotificationEvent(event).catch(() => undefined);
  });
}

const ACTION_PREFIX = 'action-';
/** Memo's champagne, used to tint the small status-bar icon. */
const NOTIFICATION_TINT = '#D4AF6A';
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
      // Older alarm channels may hold the default sound; remove them.
      for (const channel of await notifee.getChannels()) {
        if (channel.id.startsWith('alarm-')) await notifee.deleteChannel(channel.id);
      }
      for (const sound of ALARM_SOUNDS) {
        await notifee.createChannel({
          id: alarmChannelId(sound.id),
          name: `Alarm · ${sound.label}`,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: sound.id,
          bypassDnd: true,
          vibration: true,
          vibrationPattern: [500, 700, 500, 700],
        });
      }
    })();
  }
  return initPromise;
}

export async function hasNotificationPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

async function schedule(id: string, channelId: string, title: string, body: string, at: Date, alarm = false): Promise<void> {
  if (at.getTime() <= Date.now()) return;
  if (alarm) await initNotifications();
  await notifee.createTriggerNotification(
    {
      id,
      title,
      body,
      android: {
        channelId,
        // The status-bar icon must be a one-colour silhouette (Android's rule), so it is
        // tinted gold; the full-colour Memo logo shows as the large icon beside the text.
        smallIcon: 'ic_notification',
        color: NOTIFICATION_TINT,
        largeIcon: 'ic_launcher',
        pressAction: { id: 'default' },
        ...(alarm ? alarmAndroid(alarmPrefs) : null),
      },
      ...(alarm ? { ios: { sound: 'default' } } : null),
    },
    { type: TriggerType.TIMESTAMP, timestamp: at.getTime(), alarmManager: true },
  );
}

// ---- Reminders -----------------------------------------------------------------

/**
 * Schedules (or reschedules) a one-off notification for a reminder, keyed by
 * its id, so scheduling again replaces it rather than adding a second one.
 * The body is the note, or the time when there is none (never the title
 * again, which would show it twice). With `alarm` it rings like an alarm.
 */
export async function scheduleReminderNotification(
  reminderId: string,
  title: string,
  note: string | null | undefined,
  at: Date,
  alarm = false,
): Promise<void> {
  const body = note?.trim() || `${alarm ? 'Alarm' : 'Reminder'} · ${formatClock(at)}`;
  await schedule(reminderId, CHANNELS.reminders.id, title, body, at, alarm);
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
  const plural = opts.remaining === 1 ? 'task' : 'tasks';
  await schedule(
    `${STREAK_PREFIX}${opts.dateKey}`,
    CHANNELS.streak.id,
    `Don’t lose streak points`,
    `${opts.remaining} ${plural} left today. Each unfinished plan costs 1 point.`,
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
