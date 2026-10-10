import type { Dashboard } from '../streaks/streaksApi';
import { greetingFor } from '../../utils/date';

/**
 * Melo's one-line tip for the dashboard. Picks the single most useful thing
 * to say from the user's real state: never random, always short.
 */
export function satyaMessage(d: Dashboard): string {
  const { streak, total_tracks } = d;
  const today = streak.today;
  const left = today.remaining;
  const tasks = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

  if (total_tracks === 0) return 'Create your first plan to get started.';
  if (today.required === 0) return 'Nothing to tick today. Enjoy your day.';
  if (today.secured) {
    return streak.current_streak > 1 ? `All done today. Your streak is ${streak.current_streak}!` : 'All done today. Great start!';
  }
  if (streak.at_risk) return `${tasks(left)} left. Finish your plans to grow your streak.`;
  if (left === 1) return 'Just 1 task left today.';
  if (streak.current_streak === 0 && streak.total_failed_days > 0 && today.completed === 0) {
    return 'New day, fresh start. You’ve got this.';
  }
  return `${tasks(left)} left today.`;
}

export function greeting(d: Dashboard): string {
  const first = d.display_name.split(' ')[0] || d.display_name;
  return `${greetingFor(d.local_hour)}, ${first}`;
}
