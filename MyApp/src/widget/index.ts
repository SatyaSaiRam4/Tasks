import { NativeModules, Platform } from 'react-native';
import { formatDateTime } from '../utils/date';

/**
 * Feeds Memo's Android home-screen widget (MemoWidgetProvider): the streak,
 * today's tasks and the next reminder. Plain words only; nothing from the
 * Vault. On other platforms this does nothing.
 */
interface WidgetModule {
  update: (signedIn: boolean, streak: number, today: string, next: string) => void;
}

const native = NativeModules.MemoWidget as WidgetModule | undefined;

export function updateWidget(data: { streak: number; done: number; total: number; next?: { title: string; at: string } | null }) {
  if (Platform.OS !== 'android' || !native) return;
  const today =
    data.total === 0 ? 'Nothing due today' : data.done >= data.total ? `All ${data.total} tasks done today ✓` : `Today: ${data.done} of ${data.total} tasks done`;
  const next = data.next ? `⏰ ${data.next.title} · ${formatDateTime(data.next.at)}` : 'No reminders coming up';
  native.update(true, data.streak, today, next);
}

export function clearWidget() {
  if (Platform.OS !== 'android' || !native) return;
  native.update(false, 0, '', '');
}
