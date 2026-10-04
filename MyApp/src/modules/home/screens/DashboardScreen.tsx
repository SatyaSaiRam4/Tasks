import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { colors, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { Avatar, IconButton, SectionHeader } from '../../../components/Controls';
import { AnimatedNumber, ProgressRing } from '../../../components/Progress';
import { EmptyState, ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Heatmap } from '../../../components/Heatmap';
import { Glow, Gradient } from '../../../components/Gradient';
import { Icon, type IconName } from '../../../components/Icon';
import { useCelebration } from '../../../components/Celebration';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { formatClock, formatDayShort, relativeDayLabel, toDateKey } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import { useGetDashboardQuery, useGetHistoryQuery, useGetTrackCompletionsQuery } from '../../streaks/streaksApi';
import { ActionRow, trackColor } from '../../routines/components';
import { SatyaModel } from '../../satya/SatyaModel';
import { greeting, satyaMessage } from '../../satya/messages';
import type { MainTabParamList, RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const INTRO_KEY = '@rememberly/dashboard_intro_seen';
const SEEN_COMPLETIONS_KEY = '@rememberly/seen_track_completions';

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAppSelector(selectCurrentUser);
  const satyaOn = useAppSelector(s => s.preferences.satyaEnabled);
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const history = useGetHistoryQuery();
  const completions = useGetTrackCompletionsQuery();
  const { celebrate } = useCelebration();
  const [intro, setIntro] = useState<'long' | 'short'>('short');
  const celebrated = useRef(false);

  // First visit gets the fuller Satya entrance; later visits a short one.
  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY)
      .then(seen => {
        if (!seen) {
          setIntro('long');
          AsyncStorage.setItem(INTRO_KEY, '1').catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, []);

  // Celebrate Track completions the user hasn't seen yet.
  useEffect(() => {
    if (!completions.data?.length || celebrated.current) return;
    celebrated.current = true;
    AsyncStorage.getItem(SEEN_COMPLETIONS_KEY)
      .then(raw => {
        const seen = new Set<string>(raw ? JSON.parse(raw) : []);
        const fresh = completions.data!.filter(c => !seen.has(c.id) && c.required_total > 0);
        for (const c of fresh) {
          celebrate({
            icon: 'trophy',
            tone: c.is_perfect ? 'streak' : 'success',
            eyebrow: c.is_perfect ? 'Track completed · Perfect' : 'Track completed',
            title: `${c.track_name} · ${c.duration_days} days`,
            subtitle: c.is_perfect
              ? 'Every required action, every single day. That is consistency.'
              : `You finished ${Math.round((100 * c.completed_total) / c.required_total)}% of your actions.`,
            stats: [
              { label: 'Actions', value: `${c.completed_total}/${c.required_total}` },
              { label: 'Bonus', value: c.bonus_points ? `+${c.bonus_points}` : '—' },
            ],
          });
        }
        completions.data!.forEach(c => seen.add(c.id));
        return AsyncStorage.setItem(SEEN_COMPLETIONS_KEY, JSON.stringify([...seen]));
      })
      .catch(() => undefined);
  }, [completions.data, celebrate]);

  const header = (
    <View style={styles.topRow}>
      <Text style={t.micro}>{data ? formatDayShort(data.streak.today.date) : ' '}</Text>
      <View style={styles.topActions}>
        <IconButton icon="search" accessibilityLabel="Discover people" onPress={() => navigation.navigate('Discover')} />
        <IconButton icon="settings" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        {header}
        <Skeleton height={220} rounded={radius.xl} style={styles.mb} />
        <View style={styles.row}>
          <Skeleton height={150} rounded={radius.lg} style={styles.flex} />
          <Skeleton height={150} rounded={radius.lg} style={styles.flex} />
        </View>
        <Skeleton height={64} rounded={radius.md} style={styles.mtLg} />
        <Skeleton height={64} rounded={radius.md} style={styles.mtSm} />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        {header}
        <ErrorState message={getErrorMessage(error, 'Could not load your dashboard.')} onRetry={refetch} />
      </Screen>
    );
  }

  const { streak, agenda } = data;
  const today = streak.today;
  const pending = today.remaining;
  const name = user?.display_name ?? data.display_name;

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      {header}

      {/* Satya hero */}
      <FadeIn>
        <View style={styles.hero}>
          {satyaOn ? <SatyaModel size={210} intro={intro} /> : <Avatar name={name} emoji={user?.avatar} size={72} />}
          <Text style={[t.title, styles.center]}>{greeting(data)}</Text>
          {satyaOn ? (
            <View style={styles.bubble}>
              <Text style={styles.bubbleName}>SATYA</Text>
              <Text style={[t.body, styles.bubbleText]}>{satyaMessage(data)}</Text>
            </View>
          ) : (
            <Text style={[t.body, styles.tagline]}>Stay consistent. Small actions become big results.</Text>
          )}
        </View>
      </FadeIn>

      {/* Streak at risk */}
      {streak.at_risk ? (
        <FadeIn index={1}>
          <Card gradient={gradients.danger} gradientOpacity={[0.22, 0.12]} onPress={() => navigation.navigate('RoutinesTab')} style={styles.mbLg}>
            <View style={styles.riskRow}>
              <Icon name="flame" size={22} color={colors.streak} />
              <View style={styles.flex}>
                <Text style={t.bodyStrong}>Your {streak.current_streak}-day streak is at risk</Text>
                <Text style={t.caption}>
                  {pending} {pending === 1 ? 'action' : 'actions'} remaining today
                </Text>
              </View>
              <Text style={styles.riskCta}>View</Text>
            </View>
          </Card>
        </FadeIn>
      ) : null}

      {/* Streak + today's progress */}
      <FadeIn index={2} style={styles.row}>
        <Card gradient={gradients.streak} gradientOpacity={[0.24, 0.08]} style={styles.flex} onPress={() => navigation.navigate('Consistency')} accessibilityLabel={`Current streak ${streak.current_streak} days`}>
          <View style={styles.streakTop}>
            <Glow color={colors.streak} size={90} intensity={0.45} style={styles.flameGlow} />
            <Icon name="flame" size={30} color={colors.streak} fill={today.secured ? colors.streak : 'none'} />
          </View>
          <AnimatedNumber value={streak.current_streak} style={styles.bigNumber} />
          <Text style={t.caption}>Day streak</Text>
          <Text style={[t.micro, styles.mtSm, { color: today.secured ? colors.success : colors.textTertiary }]}>
            {today.secured ? 'Today secured' : today.required ? 'Today pending' : 'Rest day'}
          </Text>
        </Card>
        <Card style={styles.flex} onPress={() => navigation.navigate('RoutinesTab')} accessibilityLabel={`${today.completed} of ${today.required} actions done today`}>
          <View style={styles.center}>
            <ProgressRing progress={today.progress} size={104} stroke={9} colorsPair={today.secured ? gradients.success : gradients.primary}>
              <Text style={styles.ringValue}>{Math.round(today.progress * 100)}%</Text>
            </ProgressRing>
            <Text style={[t.caption, styles.mtSm]}>
              {today.completed} / {today.required} actions
            </Text>
          </View>
        </Card>
      </FadeIn>

      {/* Metrics */}
      <FadeIn index={3} style={styles.metrics}>
        <Metric icon="trophy" label="Best streak" value={streak.best_streak} color={colors.streakGold} />
        <Metric icon="check-circle" label="Done today" value={today.completed} color={colors.success} />
        <Metric icon="clock" label="Pending" value={pending} color={colors.primary} />
        <Metric icon="target" label="Active tracks" value={data.active_tracks} color={colors.info} />
      </FadeIn>

      {/* Today's actions */}
      <SectionHeader title="Today's actions" action="Open routines" onAction={() => navigation.navigate('RoutinesTab')} />
      {agenda.groups.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon="target"
            title={data.total_tracks ? 'Nothing planned today' : 'Create your first Track'}
            message={data.total_tracks ? 'Your day is clear. Add an action to keep moving.' : 'A Track is a goal like Gym or Study. Add actions inside it.'}
            actionLabel={data.total_tracks ? 'Open routines' : 'Create Track'}
            onAction={() => (data.total_tracks ? navigation.navigate('RoutinesTab') : navigation.navigate('TrackEditor'))}
          />
        </Card>
      ) : (
        agenda.groups.map(group => (
          <View key={group.track.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.dot, { backgroundColor: trackColor(group.track.color) }]} />
              <Text style={[t.bodyStrong, styles.flex]}>{group.track.name}</Text>
              <Text style={t.caption}>
                {group.completed}/{group.required}
              </Text>
            </View>
            {group.items.map(item => (
              <ActionRow
                key={item.action.id}
                item={item}
                trackName={group.track.name}
                trackColorValue={trackColor(group.track.color)}
                editable={agenda.editable}
                onLongPress={() => navigation.navigate('ActionEditor', { trackId: group.track.id, actionId: item.action.id })}
              />
            ))}
          </View>
        ))
      )}

      {/* Upcoming reminders */}
      <SectionHeader title={`Upcoming reminders · ${data.reminder_count}`} action="All" onAction={() => navigation.navigate('RemindersTab')} />
      {data.upcoming_reminders.length === 0 ? (
        <Card onPress={() => navigation.navigate('ReminderEditor')}>
          <View style={styles.riskRow}>
            <Icon name="bell" size={20} color={colors.textTertiary} />
            <Text style={[t.body, styles.flex, { color: colors.textSecondary }]}>Your schedule is clear.</Text>
            <Text style={styles.riskCta}>Add</Text>
          </View>
        </Card>
      ) : (
        <Card padded={false}>
          {data.upcoming_reminders.slice(0, 3).map((r, i) => (
            <View key={r.id} style={[styles.reminderRow, i > 0 && styles.divider]}>
              <View style={styles.reminderTime}>
                <Text style={styles.reminderClock}>{formatClock(r.remind_at)}</Text>
                <Text style={t.micro}>{relativeDayLabel(toDateKey(new Date(r.remind_at)), toDateKey(new Date()))}</Text>
              </View>
              <Text style={[t.bodyStrong, styles.flex]} numberOfLines={1}>
                {r.title}
              </Text>
              {r.whatsapp_number ? <Icon name="message" size={16} color={colors.success} /> : null}
            </View>
          ))}
        </Card>
      )}

      {/* Consistency calendar */}
      <SectionHeader title="Consistency" action="History" onAction={() => navigation.navigate('Consistency')} />
      <Card onPress={() => navigation.navigate('Consistency')} accessibilityLabel="Open consistency history">
        {/* The most recent 16 weeks fit the card; the full history lives on Consistency. */}
        {history.data ? <Heatmap days={history.data.slice(-16 * 7)} cell={13} /> : <Skeleton height={120} />}
        <View style={styles.consistencyFooter}>
          <Text style={t.caption}>
            {streak.total_success_days + streak.total_failed_days > 0
              ? `${streak.consistency_pct}% of tracked days complete`
              : 'Your first tracked day will appear here'}
          </Text>
          {streak.bonus_points ? <Text style={[t.caption, { color: colors.streakGold }]}>+{streak.bonus_points} bonus</Text> : null}
        </View>
      </Card>

      {/* Quick actions */}
      <SectionHeader title="Quick actions" />
      <View style={styles.quickGrid}>
        <Quick icon="target" label="New Track" onPress={() => navigation.navigate('TrackEditor')} />
        <Quick icon="bell" label="Reminder" onPress={() => navigation.navigate('ReminderEditor')} />
        <Quick icon="lock" label="Vault" onPress={() => navigation.navigate('VaultTab')} />
        <Quick icon="users" label="Discover" onPress={() => navigation.navigate('Discover')} />
      </View>
    </Screen>
  );
}

function Metric({ icon, label, value, color }: { icon: IconName; label: string; value: number; color: string }) {
  return (
    <Card style={styles.metric} contentStyle={styles.metricContent}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}1F` }]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <AnimatedNumber value={value} style={styles.metricValue} />
      <Text style={t.caption}>{label}</Text>
    </Card>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.quick} contentStyle={styles.quickContent} accessibilityLabel={label}>
      <Gradient colors={gradients.surface} borderRadius={radius.md} style={styles.quickIcon}>
        <Icon name={icon} size={20} color={colors.primary} />
      </Gradient>
      <Text style={[t.caption, { color: colors.text }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    textAlign: 'center',
  },
  mb: {
    marginBottom: spacing.lg,
  },
  mbLg: {
    marginBottom: spacing.lg,
  },
  mtSm: {
    marginTop: spacing.sm,
  },
  mtLg: {
    marginTop: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  tagline: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  bubble: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    maxWidth: 340,
  },
  bubbleName: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  bubbleText: {
    color: colors.text,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  riskCta: {
    color: colors.primary,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  streakTop: {
    height: 36,
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    left: -30,
    top: -27,
  },
  bigNumber: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    marginTop: spacing.sm,
  },
  ringValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metric: {
    width: '47.5%',
    flexGrow: 1,
  },
  metricContent: {
    padding: spacing.md,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  group: {
    marginBottom: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  reminderTime: {
    width: 76,
  },
  reminderClock: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  consistencyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quick: {
    flex: 1,
  },
  quickContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  quickIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
