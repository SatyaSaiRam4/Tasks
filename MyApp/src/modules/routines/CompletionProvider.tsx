import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useAppSelector } from '../../app/hooks';
import { colors, radius, spacing, type as t } from '../../theme';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useCelebration } from '../../components/Celebration';
import { getErrorMessage } from '../../utils/apiError';
import { formatClock } from '../../utils/date';
import { useCompleteActionMutation, useUncompleteActionMutation, type Action } from './routinesApi';

interface Target {
  action: Action;
  trackName: string;
  isCompleted: boolean;
}

interface CompletionApi {
  /** Opens the confirmation flow for an Action due today. */
  request: (target: Target) => void;
}

const CompletionContext = createContext<CompletionApi>({ request: () => undefined });

export function useCompletion() {
  return useContext(CompletionContext);
}

/**
 * Owns the one place Actions get completed. A tap never completes directly:
 * it opens a confirmation sheet, and only an explicit "Yes, I completed it"
 * (or the lighter Quick-mode confirm) records the completion on the server.
 */
export function CompletionProvider({ children }: { children: React.ReactNode }) {
  const mode = useAppSelector(s => s.preferences.confirmationMode);
  const { celebrate } = useCelebration();
  const [target, setTarget] = useState<Target | null>(null);
  const [complete, { isLoading: completing }] = useCompleteActionMutation();
  const [uncomplete, { isLoading: undoing }] = useUncompleteActionMutation();

  const close = useCallback(() => setTarget(null), []);

  const confirm = async () => {
    if (!target) return;
    try {
      const result = await complete({ id: target.action.id, method: mode }).unwrap();
      close();
      if (result.day_just_secured) {
        celebrate({
          icon: 'flame',
          tone: 'streak',
          eyebrow: 'Day complete',
          title: result.current_streak > 1 ? `${result.current_streak} day streak` : 'Your streak has started',
          subtitle:
            result.current_streak > 1
              ? 'Every required action done. Your consistency continues.'
              : 'Every required action done. Come back tomorrow to make it two.',
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
      Toast.fail(getErrorMessage(err, 'Could not complete this action.'), 2);
    }
  };

  const undo = async () => {
    if (!target) return;
    try {
      await uncomplete(target.action.id).unwrap();
      close();
      Toast.info('Marked as not done.', 1.2);
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not update this action.'), 2);
    }
  };

  const value = useMemo(() => ({ request: (t2: Target) => setTarget(t2) }), []);

  const action = target?.action;
  const time = action?.time_of_day ? formatClock(action.time_of_day) : null;

  return (
    <CompletionContext.Provider value={value}>
      {children}
      <Sheet visible={Boolean(target)} onClose={close}>
        {target && action ? (
          target.isCompleted ? (
            <View>
              <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
                <Icon name="refresh" size={24} color={colors.textSecondary} />
              </View>
              <Text style={[t.heading, styles.center]}>Mark as not done?</Text>
              <Text style={styles.message}>
                "{action.title}" will go back to pending for today. You can confirm it again later.
              </Text>
              <View style={styles.actions}>
                <Button label="Mark as not done" variant="secondary" size="lg" onPress={undo} loading={undoing} />
                <Button label="Keep it completed" variant="ghost" onPress={close} />
              </View>
            </View>
          ) : (
            <View>
              <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
                <Icon name="check-circle" size={28} color={colors.success} />
              </View>
              <Text style={[t.micro, styles.center]}>Confirm completion</Text>
              <Text style={[t.heading, styles.center, styles.question]}>
                {mode === 'QUICK' ? 'Done with this one?' : 'Did you actually complete this?'}
              </Text>
              <View style={styles.actionCard}>
                <Text style={t.subtitle}>{action.title}</Text>
                <Text style={[t.caption, styles.meta]}>
                  {target.trackName}
                  {time ? ` · ${time}` : ''}
                </Text>
                {mode === 'STANDARD' && action.steps.length ? (
                  <View style={styles.steps}>
                    {action.steps.map(s => (
                      <View key={s.id} style={styles.step}>
                        <Icon name="check" size={14} color={colors.success} />
                        <Text style={t.caption}>{s.title}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              {mode === 'STANDARD' ? (
                <Text style={styles.pledge}>I confirm I completed this action. Honest streaks are the ones that matter.</Text>
              ) : null}
              <View style={styles.actions}>
                <Button
                  label="Yes, I completed it"
                  variant="success"
                  size="lg"
                  icon="check"
                  onPress={confirm}
                  loading={completing}
                  accessibilityHint="Records this action as completed for today"
                />
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
  },
  badge: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  question: {
    marginTop: spacing.xs,
  },
  message: {
    ...t.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actionCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  meta: {
    marginTop: 4,
  },
  steps: {
    marginTop: spacing.md,
    gap: 6,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pledge: {
    ...t.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
    color: colors.textTertiary,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
