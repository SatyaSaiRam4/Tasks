import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useAppSelector } from '../../app/hooks';
import { colors, spacing, type as t } from '../../theme';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useCelebration } from '../../components/Celebration';
import { getErrorMessage } from '../../utils/apiError';
import { useCompleteActionMutation, useUncompleteActionMutation } from './routinesApi';

interface Target {
  actionId: string;
  title: string;
  isCompleted: boolean;
}

interface CompletionApi {
  /** Opens the confirmation for a task due today. */
  request: (target: Target) => void;
}

const CompletionContext = createContext<CompletionApi>({ request: () => undefined });

export function useCompletion() {
  return useContext(CompletionContext);
}

/**
 * Owns the one place tasks get completed. In the standard mode a tap asks
 * "Did you do it today?" first; in Quick mode (Settings) it ticks directly.
 */
export function CompletionProvider({ children }: { children: React.ReactNode }) {
  const mode = useAppSelector(s => s.preferences.confirmationMode);
  const { celebrate } = useCelebration();
  const [target, setTarget] = useState<Target | null>(null);
  const [complete, { isLoading: completing }] = useCompleteActionMutation();
  const [uncomplete, { isLoading: undoing }] = useUncompleteActionMutation();

  const close = useCallback(() => setTarget(null), []);

  const confirm = async (current: Target | null = target) => {
    if (!current) return;
    try {
      const result = await complete({ id: current.actionId, method: mode }).unwrap();
      close();
      if (result.day_just_secured) {
        celebrate({
          icon: 'flame',
          tone: 'streak',
          eyebrow: 'Day complete',
          title: result.current_streak > 1 ? `${result.current_streak} day streak` : 'Your streak has started',
          subtitle:
            result.current_streak > 1
              ? 'All of today’s tasks are done.'
              : 'All of today’s tasks are done. Come back tomorrow to make it two.',
          stats: [
            { label: 'Current', value: String(result.current_streak) },
            { label: 'Best', value: String(result.best_streak) },
          ],
        });
      } else if (!result.already_completed) {
        const left = result.today_required - result.today_completed;
        Toast.success(left > 0 ? `Done. ${left} left today.` : 'Done.', 1.2);
      }
      for (const a of result.new_achievements) {
        celebrate({ icon: 'award', tone: 'primary', eyebrow: 'Achievement unlocked', title: a.title, subtitle: a.description });
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not save this.'), 2);
    }
  };

  const undo = async () => {
    if (!target) return;
    try {
      await uncomplete(target.actionId).unwrap();
      close();
      Toast.info('Marked as not done.', 1.2);
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not save this.'), 2);
    }
  };

  // Quick mode ticks straight away; the standard mode asks first.
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  const value = useMemo(
    () => ({
      request: (next: Target) => (mode === 'QUICK' && !next.isCompleted ? confirmRef.current(next) : setTarget(next)),
    }),
    [mode],
  );

  return (
    <CompletionContext.Provider value={value}>
      {children}
      <Sheet visible={Boolean(target)} onClose={close}>
        {target ? (
          target.isCompleted ? (
            <View>
              <Text style={[t.heading, styles.center]}>Mark “{target.title}” as not done?</Text>
              <View style={styles.actions}>
                <Button label="Mark as not done" variant="secondary" size="lg" onPress={undo} loading={undoing} />
                <Button label="Cancel" variant="ghost" onPress={close} />
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.badge}>
                <Icon name="check-circle" size={28} color={colors.success} strokeWidth={1.6} />
              </View>
              <Text style={[t.heading, styles.center]}>Did you do “{target.title}” today?</Text>
              <View style={styles.actions}>
                <Button label="Yes, done" variant="success" size="lg" icon="check" onPress={() => confirm()} loading={completing} />
                <Button label="Not yet" variant="ghost" onPress={close} />
              </View>
            </View>
          )
        ) : null}
      </Sheet>
    </CompletionContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 32,
  },
  badge: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(140,211,179,0.35)',
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
