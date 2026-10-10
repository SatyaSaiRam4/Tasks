import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppSelector } from '../../app/hooks';
import { addDays, fromDateKey, toDateKey } from '../../utils/date';
import {
  loadAlarmPreferences,
  scheduleReminderNotification,
  syncActionNotifications,
  syncStreakWarning,
  type PlannedAction,
} from '../../notifications';
import { useGetMeQuery } from '../users/usersApi';
import { useGetDashboardQuery } from '../streaks/streaksApi';
import { useGetAgendaQuery, type Agenda } from '../routines/routinesApi';
import { useListRemindersQuery } from '../reminders/remindersApi';
import { walletApi } from '../wallet/walletApi';
import { streaksApi } from '../streaks/streaksApi';

function planned(agenda: Agenda | undefined): PlannedAction[] {
  if (!agenda) return [];
  const out: PlannedAction[] = [];
  for (const group of agenda.groups) {
    for (const item of group.items) {
      const a = item.action;
      if (a.reminder_enabled && a.time_of_day && !item.is_completed) {
        out.push({ id: a.id, title: a.title, trackName: group.track.name, dateKey: agenda.date, timeOfDay: a.time_of_day });
      }
    }
  }
  return out;
}

/**
 * Keeps on-device state in step with the server while signed in: user
 * preferences, Action reminder notifications (today + tomorrow), the
 * streak-at-risk warning, and reminder alarms (re-armed after reinstall).
 * Renders nothing.
 */
export function BackgroundSync() {
  const prefs = useAppSelector(s => s.preferences);
  const me = useGetMeQuery();
  const dashboard = useGetDashboardQuery(undefined, { pollingInterval: 5 * 60 * 1000 });
  const todayKey = dashboard.data?.streak.today.date;
  const tomorrowKey = todayKey ? toDateKey(addDays(fromDateKey(todayKey), 1)) : undefined;
  const tomorrow = useGetAgendaQuery(tomorrowKey ? { day: tomorrowKey } : undefined, { skip: !tomorrowKey });
  const reminders = useListRemindersQuery();

  // Load the screens one tap away, so opening them is instant.
  const prefetchWallet = walletApi.usePrefetch('getWallet');
  const prefetchStreak = streaksApi.usePrefetch('getStreak');
  useEffect(() => {
    prefetchWallet(undefined, { ifOlderThan: 300 });
    prefetchStreak(undefined, { ifOlderThan: 300 });
  }, [prefetchWallet, prefetchStreak]);

  // Refresh when the app returns to the foreground (the day may have changed).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        dashboard.refetch();
        me.refetch();
      }
    });
    return () => sub.remove();
  }, [dashboard, me]);

  useEffect(() => {
    if (!dashboard.data) return;
    const actions = prefs.notifyActions ? [...planned(dashboard.data.agenda), ...planned(tomorrow.data)] : [];
    syncActionNotifications(actions).catch(() => undefined);
    const s = dashboard.data.streak;
    syncStreakWarning({
      dateKey: s.today.date,
      streak: s.current_streak,
      remaining: s.today.remaining,
      enabled: prefs.notifyStreakWarnings,
    }).catch(() => undefined);
  }, [dashboard.data, tomorrow.data, prefs.notifyActions, prefs.notifyStreakWarnings]);

  // Re-runs when the alarm sound or length changes in Settings, so alarms
  // already scheduled pick up the new choice.
  useEffect(() => {
    if (!reminders.data || !prefs.notifyReminders) return;
    const now = Date.now();
    loadAlarmPreferences().then(() => {
      for (const r of reminders.data!) {
        const at = new Date(r.remind_at);
        if (r.status === 'ACTIVE' && !r.completed_at && at.getTime() > now) {
          scheduleReminderNotification(r.id, r.title, r.note, at, r.alarm_enabled).catch(() => undefined);
        }
      }
    });
  }, [reminders.data, prefs.notifyReminders, prefs.alarmVersion]);

  return null;
}
