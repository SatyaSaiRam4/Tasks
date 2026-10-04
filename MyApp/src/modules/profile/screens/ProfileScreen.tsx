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
                  onPress={() => Share.share({ message: `Find me on Memo: ${data.me.public_id}` })}
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
            <Stat icon="check-circle" color={colors.success} label="Days done" value={data.stats.total_success_days} />
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
    <Card style={styles.stat} contentStyle={styles.statContent}>
      <Icon name={icon} size={18} color={color} />
      <AnimatedNumber value={value} style={styles.statValue} />
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
    flex: 1,
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
