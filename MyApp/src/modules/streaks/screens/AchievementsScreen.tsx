import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, gradients, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { Gradient } from '../../../components/Gradient';
import { Icon, type IconName } from '../../../components/Icon';
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

export function AchievementsScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useListAchievementsQuery();
  const earned = data?.filter(a => a.earned).length ?? 0;

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <ScreenHeader title="Achievements" subtitle={data ? `${earned} of ${data.length} earned` : undefined} />
      {isLoading ? (
        <SkeletonList count={5} height={80} />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : (
        data.map((a, i) => (
          <FadeIn key={a.code} index={i}>
            <Card style={[styles.card, !a.earned && styles.locked]} accessibilityLabel={`${a.title}, ${a.earned ? 'earned' : 'locked'}`}>
              <View style={styles.row}>
                {a.earned ? (
                  <Gradient colors={gradients.gold} borderRadius={26} style={styles.badge}>
                    <View style={styles.badgeInner}>
                      <Icon name={achievementIcon(a.icon)} size={21} color={colors.goldBright} strokeWidth={1.7} />
                    </View>
                  </Gradient>
                ) : (
                  <View style={[styles.badge, styles.badgeLocked]}>
                    <Icon name="lock" size={17} color={colors.textTertiary} strokeWidth={1.7} />
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={styles.title}>{a.title}</Text>
                  <Text style={t.caption}>{a.description}</Text>
                </View>
                {a.earned && a.earned_at ? <Text style={styles.date}>{formatFullDate(a.earned_at)}</Text> : null}
              </View>
            </Card>
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    marginBottom: spacing.md,
  },
  locked: {
    opacity: 0.5,
  },
  title: {
    ...font.serif,
    fontSize: 17,
    lineHeight: 20,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 52,
    height: 52,
    padding: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111830',
  },
  badgeLocked: {
    borderRadius: 26,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  date: {
    ...font.medium,
    color: colors.textTertiary,
    fontSize: 11,
  },
});
