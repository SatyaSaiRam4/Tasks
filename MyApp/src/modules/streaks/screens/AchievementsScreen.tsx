import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { brand, colors, font, gradients, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Eyebrow, ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { Glow, Gradient } from '../../../components/Gradient';
import { Icon, type IconName } from '../../../components/Icon';
import { AnimatedNumber, ProgressBar } from '../../../components/Progress';
import { useLayout } from '../../../hooks/useLayout';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { useListAchievementsQuery } from '../streaksApi';

const ICON_MAP: Record<string, IconName> = {
  sparkles: 'sparkles',
  flame: 'flame',
  trophy: 'trophy',
  crown: 'crown',
  'check-circle': 'check-circle',
  sunrise: 'sunrise',
  refresh: 'refresh',
  flag: 'flag',
  award: 'award',
};

export function achievementIcon(icon: string): IconName {
  return ICON_MAP[icon] ?? 'award';
}

/** A gold-rimmed midnight badge for an earned achievement (or a quiet locked one). */
export function AchievementBadge({ icon, earned = true, size = 52 }: { icon: string; earned?: boolean; size?: number }) {
  if (!earned) {
    return (
      <View style={[styles.badgeLocked, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name="lock" size={size * 0.32} color={colors.textTertiary} strokeWidth={1.6} />
      </View>
    );
  }
  return (
    <Gradient colors={gradients.gold} borderRadius={size / 2} style={{ width: size, height: size, padding: 1.5 }}>
      <View style={[styles.badgeInner, { borderRadius: size / 2 }]}>
        <Icon name={achievementIcon(icon)} size={size * 0.4} color={brand.champagneLight} strokeWidth={1.6} />
      </View>
    </Gradient>
  );
}

export function AchievementsScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useListAchievementsQuery();
  const { columns } = useLayout();
  const earned = data?.filter(a => a.earned).length ?? 0;
  const cell = columns > 1 ? styles.half : null;

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <ScreenHeader title="Achievements" subtitle={data ? `${earned} of ${data.length} earned` : 'Collection'} />
      {isLoading ? (
        <SkeletonList count={5} height={84} />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : (
        <>
          <FadeIn>
            <Card tone="hero" contentStyle={styles.hero}>
              <Glow color={brand.champagne} size={320} intensity={0.16} style={styles.heroGlow} />
              <Eyebrow label="Your collection" color={brand.champagne} />
              <View style={styles.heroRow}>
                <AnimatedNumber value={earned} style={styles.heroNum} />
                <Text style={styles.heroOf}>of {data.length} badges</Text>
              </View>
              <ProgressBar progress={data.length ? earned / data.length : 0} height={4} colorsPair={gradients.gold} style={styles.heroBar} />
            </Card>
          </FadeIn>
          <View style={[styles.list, columns > 1 && styles.grid]}>
            {data.map((a, i) => (
              <FadeIn key={a.code} index={i + 1} style={cell}>
                <Card style={[styles.card, !a.earned && styles.locked]} accessibilityLabel={`${a.title}, ${a.earned ? 'earned' : 'locked'}`}>
                  <View style={styles.row}>
                    <AchievementBadge icon={a.icon} earned={a.earned} />
                    <View style={styles.flex}>
                      <Text style={styles.title}>{a.title}</Text>
                      <Text style={t.caption}>{a.description}</Text>
                      {a.earned && a.earned_at ? <Text style={styles.date}>Earned {formatFullDate(a.earned_at)}</Text> : null}
                    </View>
                  </View>
                </Card>
              </FadeIn>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    padding: spacing.xxl,
  },
  heroGlow: {
    position: 'absolute',
    top: -160,
    right: -120,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroNum: {
    ...t.hero,
    color: brand.champagneLight,
  },
  heroOf: {
    ...font.serifItalic,
    fontSize: 20,
    color: colors.heroTextSecondary,
  },
  heroBar: {
    marginTop: spacing.lg,
  },
  list: {
    marginTop: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
  },
  half: {
    width: '48.8%',
  },
  card: {
    marginBottom: spacing.md,
  },
  locked: {
    opacity: 0.72,
  },
  title: {
    ...t.heading,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  badgeInner: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.midnight,
  },
  badgeLocked: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  date: {
    ...font.bold,
    color: colors.gold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    marginTop: spacing.xs,
  },
});
