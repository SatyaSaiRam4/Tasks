/**
 * Local reminder notifications, powered by react-native-notify-kit (a
 * maintained, New-Architecture-only fork of the archived Notifee — same API).
 *
 * These are fully on-device: scheduling a trigger notification here does not
 * touch the backend or need a network connection, and it survives the app
 * being backgrounded or killed (Android's AlarmManager fires it). The
 * backend is only involved for the optional WhatsApp side-channel (see
 * src/modules/reminders/remindersApi.ts), since that has to be sent from a
 * server regardless of the device's state.
 */
import notifee, {
  AndroidImportance,
  AndroidNotificationSetting,
  AndroidVisibility,
  AuthorizationStatus,
  TriggerType,
} from 'react-native-notify-kit';

const CHANNEL_ID = 'reminders';

let initPromise: Promise<void> | null = null;

/** Creates the Android notification channel and requests permission. Call once at app boot. */
export function initNotifications(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await notifee.requestPermission();
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Reminders',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
      });
    })();
  }
  return initPromise;
}

export async function hasNotificationPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

/** Schedules (or reschedules) a one-off local notification for a reminder, keyed by the reminder's own id. */
export async function scheduleReminderNotification(reminderId: string, title: string, body: string, at: Date): Promise<void> {
  await notifee.createTriggerNotification(
    {
      id: reminderId,
      title,
      body,
      android: {
        channelId: CHANNEL_ID,
        pressAction: { id: 'default' },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: at.getTime(),
      alarmManager: true,
    },
  );
}

/** Cancels a previously scheduled reminder notification, e.g. when the reminder is edited to a new time or deleted. */
export async function cancelReminderNotification(reminderId: string): Promise<void> {
  await notifee.cancelTriggerNotification(reminderId);
}

/**
 * On Android 12+, exact-time delivery needs the user to separately grant the
 * "Alarms & reminders" special app permission — without it, reminders still
 * fire, but as an inexact alarm the OS can delay by a few minutes. Returns
 * false when the user should be prompted to enable it.
 */
export async function hasExactAlarmPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  const alarmSetting = settings.android?.alarm;
  // NOT_SUPPORTED means the OS version doesn't require this permission at all.
  return alarmSetting !== AndroidNotificationSetting.DISABLED;
}

export function openExactAlarmSettings(): Promise<void> {
  return notifee.openAlarmPermissionSettings();
}
