import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../../app/hooks';
import { colors, font, gradients, radius, spacing, type as t } from '../../../theme';
import { Glow } from '../../../components/Gradient';
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
      <LargeTitle title="Profile" hideProfile />
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
            <Gradient colors={gradients.moonlight} direction="vertical" borderRadius={radius.xl} style={styles.hero}>
              <View style={styles.heroSheen} pointerEvents="none" />
              <View style={styles.avatarWrap}>
                <Glow color={colors.gold} size={190} intensity={0.22} style={styles.avatarGlow} />
                <Avatar name={data.me.display_name} emoji={data.me.avatar} size={96} />
              </View>
              <Text style={[t.title, styles.name]}>{data.me.display_name}</Text>
              <View style={styles.idRow}>
                <Text style={styles.id}>ID: {data.me.public_id}</Text>
                <IconButton
                  icon="copy"
                  variant="plain"
                  size={16}
                  color={colors.textSecondary}
                  accessibilityLabel="Share your User ID"
                  onPress={() => Share.share({ message: `Find me on Memo: ${data.me.public_id}` })}
                />
              </View>
              <Pill
                icon={data.me.settings.is_public_profile ? 'users' : 'lock'}
                label={data.me.settings.is_public_profile ? 'Public profile' : 'Private profile'}
                color={data.me.settings.is_public_profile ? colors.success : colors.textSecondary}
                background={data.me.settings.is_public_profile ? colors.successSoft : colors.surfaceHigh}
                style={styles.centerSelf}
              />
            </Gradient>
          </FadeIn>

          <FadeIn index={1} style={styles.statsWrap}>
            <Card padded={false}>
              <View style={styles.grid}>
                <Stat icon="flame" color={colors.streak} label="Day streak" value={data.stats.current_streak} />
                <View style={styles.statDivider} />
                <Stat icon="trophy" color={colors.streakGold} label="Best streak" value={data.stats.best_streak} />
                <View style={styles.statDivider} />
                <Stat icon="check-circle" color={colors.success} label="Days done" value={data.stats.total_success_days} />
              </View>
            </Card>
          </FadeIn>

          <SectionHeader title="Badges" action="See all" onAction={() => navigation.navigate('Achievements')} />
          {data.achievements.length === 0 ? (
            <Card onPress={() => navigation.navigate('Achievements')}>
              <Text style={[t.body, { color: colors.textSecondary }]}>Badges show up here as you keep your streak going. Your first one comes after your first full day.</Text>
            </Card>
          ) : (
            <View style={styles.badges}>
              {data.achievements.slice(0, 8).map(a => (
                <View key={a.code} style={styles.badge} accessible accessibilityLabel={a.title}>
                  <Gradient colors={gradients.gold} borderRadius={28} style={styles.badgeIcon}>
                    <View style={styles.badgeInner}>
                      <Icon name={achievementIcon(a.icon)} size={20} color={colors.goldBright} strokeWidth={1.7} />
                    </View>
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
            <ListRow icon="calendar" title="Streak history" onPress={() => navigation.navigate('Consistency')} />
            <ListRow icon="users" title="Find friends" subtitle="See a friend’s streak by their User ID" onPress={() => navigation.navigate('Discover')} />
            <ListRow icon="settings" title="Settings" onPress={() => navigation.navigate('Settings')} last={!isAdmin} />
            {isAdmin ? <ListRow icon="shield" title="Admin panel" onPress={() => navigation.navigate('AdminDashboard')} last /> : null}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}

function Stat({ icon, color, label, value }: { icon: 'flame' | 'trophy' | 'check-circle'; color: string; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={16} color={color} strokeWidth={1.8} />
      <AnimatedNumber value={value} style={styles.statValue} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mtLg: {
    marginTop: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    padding: spacing.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    gap: spacing.sm,
  },
  heroSheen: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(241,221,175,0.45)',
  },
  centerSelf: {
    alignSelf: 'center',
  },
  avatarWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    left: -35,
    top: -35,
  },
  name: {
    ...t.display,
    fontSize: 30,
    textAlign: 'center',
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  id: {
    ...font.bold,
    color: colors.gold,
    fontSize: 12,
    letterSpacing: 2,
  },
  statsWrap: {
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...font.serif,
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
  },
  statLabel: {
    ...t.caption,
    fontSize: 12,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  badge: {
    width: 76,
    alignItems: 'center',
    gap: 8,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    padding: 1.5,
  },
  badgeInner: {
    flex: 1,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111830',
  },
  badgeText: {
    ...font.medium,
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
});
