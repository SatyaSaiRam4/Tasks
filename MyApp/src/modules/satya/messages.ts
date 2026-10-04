import type { Dashboard } from '../streaks/streaksApi';
import { greetingFor } from '../../utils/date';

/**
 * Satya's one-line message for the dashboard. Picks the single most useful
 * thing to say from the user's real state: never random, always short.
 */
export function satyaMessage(d: Dashboard): string {
  const { streak, agenda, total_tracks } = d;
  const today = streak.today;
  const hour = d.local_hour;

  if (total_tracks === 0) return "Let's create your first Track. Start small, one action is enough.";
  if (agenda.required === 0 && agenda.groups.length === 0) {
    return 'Your day is clear. Maybe add one small action to keep moving?';
  }
  if (today.secured) {
    if (streak.current_streak >= 7) return `Perfect day. That's ${streak.current_streak} in a row, keep it going.`;
    return 'Perfect day. Your streak continues.';
  }
  if (streak.at_risk) {
    const n = today.remaining;
    return `Your ${streak.current_streak}-day streak is at risk. ${n} ${n === 1 ? 'action' : 'actions'} left.`;
  }
  if (today.remaining === 1) return "You're one action away from completing today.";
  if (streak.current_streak === 0 && streak.total_failed_days > 0 && today.completed === 0) {
    return "Don't worry about yesterday. Let's focus on today.";
  }
  if (streak.current_streak >= 3) return `You're on a ${streak.current_streak}-day streak. Keep going.`;
  if (hour < 12) return `Good morning. You have ${today.required} ${today.required === 1 ? 'action' : 'actions'} planned today.`;
  return `${today.remaining} of ${today.required} actions left today. Small steps count.`;
}

export function greeting(d: Dashboard): string {
  const first = d.display_name.split(' ')[0] || d.display_name;
  return `${greetingFor(d.local_hour)}, ${first}.`;
}
