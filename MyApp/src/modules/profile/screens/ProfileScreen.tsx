import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../../app/hooks';
import { colors, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Avatar, IconButton, Pill, SectionHeader } from '../../../components/Controls';
import { AnimatedNumber } from '../../../components/Progress';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Gradient } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { selectIsAdmin } from '../../auth/authSlice';
import { useGetMyProfileQuery } from '../../users/usersApi';
import { achievementIcon } from '../../streaks/screens/AchievementsScreen';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data, isLoading, isError, error, refetch, isFetching } = useGetMyProfileQuery();

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <LargeTitle title="Profile" right={<IconButton icon="settings" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />} />
      {isLoading ? (
        <>
          <Skeleton height={200} rounded={radius.xl} />
          <Skeleton height={120} rounded={radius.lg} style={styles.mtLg} />
        </>
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error, 'Could not load your profile.')} onRetry={refetch} />
      ) : (
        <>
          <FadeIn>
            <Gradient colors={gradients.surface} borderRadius={radius.xl} style={styles.hero}>
              <Avatar name={data.me.display_name} emoji={data.me.avatar} size={76} />
              <Text style={[t.title, styles.name]}>{data.me.display_name}</Text>
              <View style={styles.idRow}>
                <Text style={styles.id}>ID: {data.me.public_id}</Text>
                <IconButton
                  icon="copy"
                  variant="plain"
                  size={16}
                  color={colors.textSecondary}
                  accessibilityLabel="Share your User ID"
                  onPress={() => Share.share({ message: `Find me on Rememberly: ${data.me.public_id}` })}
                />
              </View>
              <Pill
                icon={data.me.settings.is_public_profile ? 'users' : 'lock'}
                label={data.me.settings.is_public_profile ? 'Public profile' : 'Private profile'}
                color={data.me.settings.is_public_profile ? colors.success : colors.textSecondary}
                background={data.me.settings.is_public_profile ? colors.successSoft : colors.surfaceHigh}
              />
            </Gradient>
          </FadeIn>

          <FadeIn index={1} style={styles.grid}>
            <Stat icon="flame" color={colors.streak} label="Day streak" value={data.stats.current_streak} />
            <Stat icon="trophy" color={colors.streakGold} label="Best streak" value={data.stats.best_streak} />
            <Stat icon="flag" color={colors.info} label="Completed tracks" value={data.stats.completed_tracks} />
            <Stat icon="zap" color={colors.success} label="Consistency" value={Math.round(data.stats.consistency_pct)} suffix="%" />
          </FadeIn>
          <Card style={styles.mtMd}>
            <View style={styles.scoreRow}>
              <View style={styles.flex}>
                <Text style={t.micro}>Consistency score</Text>
                <AnimatedNumber value={data.stats.consistency_score} style={styles.score} />
              </View>
              <View style={styles.flex}>
                <Text style={t.caption}>
                  {data.stats.total_completed_actions} {data.stats.total_completed_actions === 1 ? 'action' : 'actions'} completed
                </Text>
                <Text style={t.caption}>
                  {data.stats.perfect_tracks} perfect {data.stats.perfect_tracks === 1 ? 'track' : 'tracks'}
                </Text>
                <Text style={t.caption}>Since {formatFullDate(data.stats.tracking_started_on)}</Text>
              </View>
            </View>
          </Card>

          <SectionHeader title="Achievements" action="See all" onAction={() => navigation.navigate('Achievements')} />
          {data.achievements.length === 0 ? (
            <Card onPress={() => navigation.navigate('Achievements')}>
              <Text style={[t.body, { color: colors.textSecondary }]}>Complete your first full day to earn “First Step”.</Text>
            </Card>
          ) : (
            <View style={styles.badges}>
              {data.achievements.slice(0, 8).map(a => (
                <View key={a.code} style={styles.badge} accessible accessibilityLabel={a.title}>
                  <Gradient colors={gradients.streak} borderRadius={radius.md} style={styles.badgeIcon}>
                    <Icon name={achievementIcon(a.icon)} size={20} color={colors.white} />
                  </Gradient>
                  <Text style={styles.badgeText} numberOfLines={2}>
                    {a.title}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <SectionHeader title="More" />
          <ListGroup>
            <ListRow icon="calendar" title="Consistency history" onPress={() => navigation.navigate('Consistency')} />
            <ListRow icon="users" title="Discover people" subtitle="Find a friend by User ID" onPress={() => navigation.navigate('Discover')} />
            <ListRow icon="settings" title="Settings" onPress={() => navigation.navigate('Settings')} last={!isAdmin} />
            {isAdmin ? <ListRow icon="shield" title="Admin panel" onPress={() => navigation.navigate('AdminDashboard')} last /> : null}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}

function Stat({ icon, color, label, value, suffix }: { icon: 'flame' | 'trophy' | 'flag' | 'zap'; color: string; label: string; value: number; suffix?: string }) {
  return (
    <Card style={styles.stat} contentStyle={styles.statContent}>
      <Icon name={icon} size={18} color={color} />
      <AnimatedNumber value={value} suffix={suffix} style={styles.statValue} />
      <Text style={t.caption}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  mtMd: {
    marginTop: spacing.md,
  },
  hero: {
    alignItems: 'center',
    padding: spacing.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  name: {
    marginTop: spacing.sm,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  id: {
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  stat: {
    width: '47.5%',
    flexGrow: 1,
  },
  statContent: {
    padding: spacing.md,
    gap: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  score: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.primary,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  badge: {
    width: 74,
    alignItems: 'center',
    gap: 6,
  },
  badgeIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
});
