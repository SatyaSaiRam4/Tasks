import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { brand, colors, font, gradients, radius, spacing, type as t, withAlpha } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { RealIcon } from '../../../components/RealIcon';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Glow } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { AnimatedNumber, ProgressBar } from '../../../components/Progress';
import { useMotion } from '../../../hooks/useMotion';
import { TopBar } from '../../../components/ScreenHeader';
import { useLoop } from '../../../animations';
import { useCelebration } from '../../../components/Celebration';
import { getErrorMessage } from '../../../utils/apiError';
import { formatDateTime } from '../../../utils/date';
import { useGetDashboardQuery, useGetTrackCompletionsQuery } from '../../streaks/streaksApi';
import { useListTracksQuery } from '../../routines/routinesApi';
import { categoryColor } from '../../routines/components';
import type { MainTabParamList, RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
const SEEN_COMPLETIONS_KEY = '@rememberly/seen_track_completions';

/**
 * Home, as simple as it gets: the streak in the middle, then two cards —
 * the user's plans (tap one to open it) and the next reminder. Each card's
 * arrow opens its full tab.
 */
export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const completions = useGetTrackCompletionsQuery();
  const tracks = useListTracksQuery();
  const { celebrate } = useCelebration();
  const celebrated = useRef(false);

  // Celebrate finished categories the user hasn't seen yet.
  useEffect(() => {
    if (!completions.data?.length || celebrated.current) return;
    celebrated.current = true;
    AsyncStorage.getItem(SEEN_COMPLETIONS_KEY)
      .then(raw => {
        const seen = new Set<string>(raw ? JSON.parse(raw) : []);
        for (const c of completions.data!.filter(x => !seen.has(x.id) && x.required_total > 0)) {
          celebrate({
            icon: 'trophy',
            tone: c.is_perfect ? 'streak' : 'success',
            eyebrow: 'Plan finished',
            title: c.track_name,
            subtitle: c.is_perfect
              ? `${c.duration_days} days, every task done. Amazing!`
              : `You did ${Math.round((100 * c.completed_total) / c.required_total)}% of your tasks.`,
            stats: c.bonus_points ? [{ label: 'Bonus', value: `+${c.bonus_points}` }] : undefined,
          });
        }
        completions.data!.forEach(c => seen.add(c.id));
        return AsyncStorage.setItem(SEEN_COMPLETIONS_KEY, JSON.stringify([...seen]));
      })
      .catch(() => undefined);
  }, [completions.data, celebrate]);

  if (isLoading) {
    return (
      <Screen>
        <TopBar />
        <Skeleton height={220} rounded={radius.xl} style={styles.skelTop} />
        <Skeleton height={160} rounded={radius.lg} />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <TopBar />
        <ErrorState message={getErrorMessage(error, 'Could not load your home screen.')} onRetry={refetch} />
      </Screen>
    );
  }

  const { streak } = data;
  const nextReminder = data.upcoming_reminders[0];
  const plans = (tracks.data ?? []).filter(tr => tr.status === 'ACTIVE' || tr.status === 'UPCOMING');
  // At most six tiles keep Home on one screen; the last one opens the rest.
  const shown = plans.length > MAX_TILES ? plans.slice(0, MAX_TILES - 1) : plans;
  const hidden = plans.length - shown.length;

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <TopBar />

      <FadeIn>
        <StreakHero
          count={streak.current_streak}
          best={streak.best_streak}
          today={streak.today.plans_done}
          lit={streak.today.plans_done > 0}
          onPress={() => navigation.navigate('Consistency')}
          onWallet={() => navigation.navigate('Wallet')}
        />
      </FadeIn>

      <FadeIn index={1}>
        <HomeCard icon="target" title="My plans" meta={plans.length ? `${plans.length} / 10` : undefined} onOpen={() => navigation.navigate('RoutinesTab')}>
          <View style={styles.tiles}>
            {shown.map(tr => (
              <PlanTile
                key={tr.id}
                name={tr.name}
                required={tr.today_required}
                completed={tr.today_completed}
                upcoming={tr.status === 'UPCOMING'}
                onPress={() => navigation.navigate('TrackDetail', { trackId: tr.id })}
              />
            ))}
            {hidden > 0 ? <MoreTile count={hidden} onPress={() => navigation.navigate('RoutinesTab')} /> : null}
            {!plans.length ? <MoreTile label="Create your first plan" onPress={() => navigation.navigate('TrackEditor')} add /> : null}
          </View>
        </HomeCard>
      </FadeIn>

      <FadeIn index={2}>
        <HomeCard icon="bell" title="Next reminder" onOpen={() => navigation.navigate('RemindersTab')}>
          <Pressable
            onPress={() => (nextReminder ? navigation.navigate('ReminderEditor', { reminderId: nextReminder.id }) : navigation.navigate('ReminderEditor'))}
            style={({ pressed }) => [styles.reminder, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.flex}>
              <Text style={t.bodyStrong} numberOfLines={1}>
                {nextReminder ? nextReminder.title : 'No reminders yet'}
              </Text>
              <Text style={[t.caption, styles.rowSub]}>{nextReminder ? formatDateTime(nextReminder.remind_at) : 'Tap to add one'}</Text>
            </View>
            {nextReminder?.alarm_enabled ? <Icon name="bell" size={16} color={colors.danger} /> : null}
            {!nextReminder ? <Icon name="plus" size={18} color={colors.gold} /> : null}
          </Pressable>
        </HomeCard>
      </FadeIn>
    </Screen>
  );
}

const MAX_TILES = 6;

/** The streak card: today's points, the animated flame with the total, the best; then the wallet hint. */
function StreakHero({
  count,
  best,
  today,
  lit,
  onPress,
  onWallet,
}: {
  count: number;
  best: number;
  today: number;
  lit: boolean;
  onPress: () => void;
  onWallet: () => void;
}) {
  return (
    <Card tone="hero" onPress={onPress} contentStyle={styles.streak} accessibilityLabel={`Streak ${count}. Today plus ${today}. Best ${best}. Open streak history.`}>
      <Glow color={brand.ember} size={280} intensity={0.18} style={styles.streakGlow} />
      <View style={styles.streakRow}>
        <Stat label="Today" value={`+${today}`} />
        <View style={styles.streakCenter}>
          <Flame lit={lit} />
          <AnimatedNumber value={count} style={styles.count} />
          <Text style={styles.streakLabel}>Streak</Text>
        </View>
        <Stat label="Best" value={String(best)} />
      </View>
      <Pressable onPress={onWallet} style={({ pressed }) => [styles.quote, pressed && styles.pressed]} accessibilityRole="button">
        <RealIcon name="coin" size={20} />
        <Text style={styles.quoteText}>
          Earn money with streaks · <Text style={styles.quoteStrong}>500 = ₹10</Text>
        </Text>
        <Icon name="chevron-right" size={14} color={colors.heroTextTertiary} />
      </Pressable>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * A living flame: it flickers and sways, its glow breathes, and embers drift
 * up from it. Brighter once a plan is finished today.
 */
function Flame({ lit }: { lit: boolean }) {
  const flicker = useLoop(700);
  const sway = useLoop(2300);
  const breathe = useLoop(3200);
  const scaleY = flicker.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.07] });
  const scaleX = flicker.interpolate({ inputRange: [0, 1], outputRange: [1.03, 0.97] });
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });
  const glow = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  return (
    <View style={styles.flame}>
      <Animated.View style={[styles.flameGlow, { transform: [{ scale: glow }] }]}>
        <Glow color={brand.ember} size={130} intensity={lit ? 0.75 : 0.4} />
      </Animated.View>
      <Ember delay={0} x={-14} />
      <Ember delay={700} x={10} />
      <Ember delay={1400} x={-2} />
      <Animated.View style={{ transform: [{ translateY: 6 }, { rotate }, { scaleX }, { scaleY }, { translateY: -6 }] }}>
        <RealIcon name="flame" size={70} />
      </Animated.View>
    </View>
  );
}

/** A spark that rises from the flame and fades out, over and over. */
function Ember({ delay, x }: { delay: number; x: number }) {
  const { reduced } = useMotion();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(rise, { toValue: 1, duration: 2100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, reduced, rise]);
  if (reduced) return null;
  return (
    <Animated.View
      style={[
        styles.ember,
        {
          opacity: rise.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
          transform: [
            { translateX: rise.interpolate({ inputRange: [0, 1], outputRange: [x, x * 1.6] }) },
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) },
            { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
          ],
        },
      ]}
    />
  );
}

/** A Home card: icon, title, optional count and an arrow that opens the full tab. */
function HomeCard({
  icon,
  title,
  meta,
  onOpen,
  children,
}: {
  icon: 'target' | 'bell';
  title: string;
  meta?: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card padded={false} style={styles.homeCard}>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open ${title}`}>
        <RealIcon name={icon} size={28} />
        <Text style={styles.cardTitle}>{title}</Text>
        {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
        <View style={styles.openButton}>
          <Icon name="arrow-right" size={16} color={colors.gold} />
        </View>
      </Pressable>
      {children}
    </Card>
  );
}

/** One plan as a small tile: name, today's progress bar and count. Tap to open. */
function PlanTile({
  name,
  required,
  completed,
  upcoming,
  onPress,
}: {
  name: string;
  required: number;
  completed: number;
  upcoming: boolean;
  onPress: () => void;
}) {
  const done = required > 0 && completed >= required;
  const color = categoryColor(name);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, done && styles.tileDone, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${upcoming ? 'Starts soon' : required ? `${Math.min(completed, required)} of ${required} done` : 'Nothing due today'}`}
    >
      <View style={styles.tileHead}>
        <View style={[styles.tileDot, { backgroundColor: done ? colors.success : color }]} />
        <Text style={styles.tileName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {upcoming || !required ? (
        <Text style={styles.tileMeta}>{upcoming ? 'Starts soon' : 'Nothing today'}</Text>
      ) : (
        <>
          <ProgressBar
            progress={Math.min(completed / required, 1)}
            height={4}
            colorsPair={done ? gradients.success : [withAlpha(color, 0.7), color]}
            style={styles.tileBar}
          />
          <Text style={[styles.tileMeta, done && { color: colors.success }]}>{done ? 'Done ✓' : `${completed}/${required} tasks`}</Text>
        </>
      )}
    </Pressable>
  );
}

function MoreTile({ count, label, add, onPress }: { count?: number; label?: string; add?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, styles.moreTile, pressed && styles.pressed]} accessibilityRole="button">
      <Icon name={add ? 'plus' : 'arrow-right'} size={16} color={colors.gold} />
      <Text style={styles.moreText} numberOfLines={2}>
        {label ?? `${count} more`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  skelTop: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  streak: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  streakGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: -70,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakCenter: {
    flex: 1.3,
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xl,
  },
  statValue: {
    ...font.serif,
    fontSize: 28,
    lineHeight: 32,
    color: colors.heroText,
  },
  statLabel: {
    ...t.micro,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  flame: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ember: {
    position: 'absolute',
    bottom: 26,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: brand.champagneLight,
  },
  count: {
    ...font.heavy,
    fontSize: 52,
    lineHeight: 58,
    color: brand.champagneLight,
    textAlign: 'center',
  },
  streakLabel: {
    ...t.micro,
    color: colors.heroTextSecondary,
  },
  quote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
    backgroundColor: 'rgba(243, 220, 166, 0.08)',
  },
  quoteText: {
    ...font.medium,
    fontSize: 12.5,
    color: colors.heroTextSecondary,
  },
  quoteStrong: {
    ...font.bold,
    color: brand.champagneLight,
  },
  homeCard: {
    marginTop: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  cardTitle: {
    ...t.subtitle,
    flex: 1,
  },
  cardMeta: {
    ...t.caption,
  },
  openButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tileDone: {
    borderColor: withAlpha(colors.success, 0.45),
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tileDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tileName: {
    ...t.bodyStrong,
    fontSize: 14,
    flex: 1,
  },
  tileBar: {
    marginTop: spacing.sm,
  },
  tileMeta: {
    ...t.caption,
    fontSize: 12,
    marginTop: 4,
  },
  moreTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderStyle: 'dashed',
    borderColor: colors.goldLine,
    backgroundColor: 'transparent',
    minHeight: 58,
  },
  moreText: {
    ...font.semibold,
    fontSize: 13.5,
    color: colors.gold,
    flex: 1,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 2,
    paddingBottom: spacing.md,
  },
  rowSub: {
    marginTop: 2,
  },
});
