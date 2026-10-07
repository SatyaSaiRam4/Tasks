import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { colors, gradients, radius, spacing } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/Card';
import { IconButton } from '../../../components/Controls';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { Eyebrow, TopBar } from '../../../components/ScreenHeader';
import { useLayout } from '../../../hooks/useLayout';
import { useLoop } from '../../../animations';
import { useCelebration } from '../../../components/Celebration';
import { getErrorMessage } from '../../../utils/apiError';
import { formatDayShort } from '../../../utils/date';
import { useGetDashboardQuery, useGetTrackCompletionsQuery } from '../../streaks/streaksApi';
import { useListTracksQuery } from '../../routines/routinesApi';
import type { MainTabParamList, RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;
const SEEN_COMPLETIONS_KEY = '@rememberly/seen_track_completions';

/** Home: one streak feature and two direct paths into the daily workflow. */
export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetDashboardQuery();
  const tracks = useListTracksQuery();
  const completions = useGetTrackCompletionsQuery();
  const { celebrate } = useCelebration();
  const celebrated = useRef(false);
  const { isTablet } = useLayout();

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
            eyebrow: 'Category finished',
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

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <Text style={styles.pageTitle}>Today</Text>
        {data ? <Text style={styles.date}>{formatDayShort(data.streak.today.date)}</Text> : null}
      </View>
      <IconButton
        icon="user"
        accessibilityLabel="Open profile"
        onPress={() => navigation.navigate('ProfileTab')}
      />
    </View>
  );

  if (isLoading) {
    return (
      <Screen contentStyle={styles.dashboard}>
        {header}
        <Skeleton height={236} rounded={radius.lg} />
        <View style={styles.destinationRow}>
          <Skeleton height={132} rounded={radius.md} style={styles.destinationSkeleton} />
          <Skeleton height={132} rounded={radius.md} style={styles.destinationSkeleton} />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen contentStyle={styles.dashboard}>
        {header}
        <ErrorState message={getErrorMessage(error, 'Could not load your home screen.')} onRetry={refetch} />
      </Screen>
    );
  }

  const { streak } = data;

  return (
    <Screen
      contentStyle={styles.dashboard}
      onRefresh={() => {
        refetch();
        tracks.refetch();
      }}
      refreshing={isFetching && !isLoading}
    >
      {header}
      <FadeIn style={styles.streakWrap}>
        <Card
          gradient={gradients.dashboard}
          onPress={() => navigation.navigate('Consistency')}
          contentStyle={styles.streakContent}
          accessibilityLabel={`${streak.current_streak} day streak`}
        >
          <View style={styles.streakCopy}>
            <Text style={styles.streakEyebrow}>CURRENT STREAK</Text>
            <View style={styles.streakNumberRow}>
              <Text style={styles.streakNum}>{streak.current_streak}</Text>
              <Text style={styles.streakUnit}>days</Text>
            </View>
          </View>
          <View style={styles.flameBadge}>
            <Icon name="flame" size={32} color={colors.streakGold} strokeWidth={2.2} />
          </View>
        </Card>
      </FadeIn>
    </>
  );

      <View style={styles.destinationRow}>
        <Card
          onPress={() => navigation.navigate('RoutinesTab')}
          style={styles.destinationCard}
          contentStyle={styles.destinationContent}
          accessibilityLabel={tracks.data ? `${tracks.data.length} categories` : 'Open categories'}
        >
          <View style={styles.destinationIcon}>
            <Icon name="target" size={22} color={colors.primary} />
          </View>
          <Text style={styles.destinationCount}>{tracks.data ? tracks.data.length : '...'}</Text>
          <View style={styles.destinationFooter}>
            <Text style={styles.destinationTitle}>Categories</Text>
            <Icon name="arrow-right" size={17} color={colors.textTertiary} />
          </View>
        </Card>
        <Card
          onPress={() => navigation.navigate('RemindersTab')}
          style={styles.destinationCard}
          contentStyle={styles.destinationContent}
          accessibilityLabel={`${data.reminder_count} reminders`}
        >
          <View style={styles.destinationIcon}>
            <Icon name="bell" size={22} color={colors.primary} />
          </View>
          <Text style={styles.destinationCount}>{data.reminder_count}</Text>
          <View style={styles.destinationFooter}>
            <Text style={styles.destinationTitle}>Reminders</Text>
            <Icon name="arrow-right" size={17} color={colors.textTertiary} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

/** The streak flame with a slow breathing halo; brighter once today is secured. */
function FlameMark({ lit }: { lit: boolean }) {
  const breathe = useLoop(3200);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <View style={styles.flame}>
      <Animated.View style={[styles.flameGlow, { transform: [{ scale }] }]}>
        <Glow color={colors.streak} size={44} intensity={lit ? 0.7 : 0.45} />
      </Animated.View>
      <Icon name="flame" size={18} color={colors.streak} fill={lit ? colors.streak : 'none'} strokeWidth={1.8} />
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
    paddingBottom: 132,
  },
  skelEyebrow: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    gap: 2,
  },
  pageTitle: {
    color: colors.text,
    fontFamily: 'serif',
    fontSize: 30,
    fontWeight: '700',
  },
  date: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  streakContent: {
    minHeight: 196,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  streakWrap: {
    marginBottom: spacing.lg,
  },
  streakCopy: {
    gap: spacing.xs,
  },
  streakEyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '700',
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  flameBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  streakNum: {
    fontFamily: 'serif',
    fontSize: 68,
    lineHeight: 76,
    fontWeight: '700',
    color: colors.white,
  },
  streakUnit: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 16,
    fontWeight: '500',
  },
  destinationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  destinationSkeleton: {
    flex: 1,
  },
  destinationCard: {
    flex: 1,
    minWidth: 0,
  },
  destinationContent: {
    minHeight: 142,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  destinationIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  destinationCount: {
    color: colors.text,
    fontFamily: 'serif',
    fontSize: 30,
    fontWeight: '700',
  },
  destinationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  destinationTitle: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
