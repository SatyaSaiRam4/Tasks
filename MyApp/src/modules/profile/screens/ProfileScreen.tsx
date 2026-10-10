import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../../app/hooks';
import { brand, colors, font, gradients, radius, spacing, type as t } from '../../../theme';
import { Glow } from '../../../components/Gradient';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Avatar, IconButton, Pill, SectionHeader } from '../../../components/Controls';
import { AnimatedNumber } from '../../../components/Progress';
import { ErrorState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Gradient, Sheen } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { getErrorMessage } from '../../../utils/apiError';
import { selectIsAdmin } from '../../auth/authSlice';
import { useGetMyProfileQuery } from '../../users/usersApi';
import { TierRow } from '../../streaks/Tiers';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data, isLoading, isError, error, refetch, isFetching } = useGetMyProfileQuery();

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <LargeTitle title="Profile" />
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
            <Gradient colors={gradients.hero} direction="diagonal" borderRadius={radius.xl} style={styles.hero}>
              <Glow color={brand.azure} size={420} intensity={0.14} style={styles.heroGlowA} />
              <Glow color={brand.champagne} size={360} intensity={0.12} style={styles.heroGlowB} />
              <Sheen color={gradients.heroSheen} inset="20%" />
              <View style={styles.avatarWrap}>
                <Glow color={brand.champagne} size={200} intensity={0.3} style={styles.avatarGlow} />
                <Avatar name={data.me.display_name} emoji={data.me.avatar} photo={data.me.photo_url} size={84} />
              </View>
              <Text style={[t.title, styles.name]}>{data.me.display_name}</Text>
              <View style={styles.idRow}>
                <Text style={styles.id}>{data.me.public_id}</Text>
                <IconButton
                  icon="copy"
                  variant="plain"
                  size={15}
                  color={colors.heroTextSecondary}
                  accessibilityLabel="Share your User ID"
                  onPress={() => Share.share({ message: `Find me on Memo: ${data.me.public_id}` })}
                />
              </View>
              <Pill
                icon={data.me.settings.is_public_profile ? 'users' : 'lock'}
                label={data.me.settings.is_public_profile ? 'Public profile' : 'Private profile'}
                color={data.me.settings.is_public_profile ? brand.jade : colors.heroTextSecondary}
                background={colors.heroGlass}
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

          <SectionHeader title="Badges" />
          <TierRow best={data.stats.best_streak} />

          <SectionHeader title="More" />
          <ListGroup>
            <ListRow icon="flame" title="Streak & progress" subtitle="History, milestones and calendar" onPress={() => navigation.navigate('Consistency')} />
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
  mtLg: {
    marginTop: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
    gap: spacing.sm,
  },
  heroGlowA: {
    position: 'absolute',
    top: -200,
    left: -160,
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -200,
    right: -140,
  },
  centerSelf: {
    alignSelf: 'center',
  },
  avatarWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    left: -50,
    top: -50,
  },
  name: {
    ...t.display,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    color: colors.heroText,
    marginTop: spacing.sm,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  id: {
    ...font.bold,
    color: brand.champagne,
    fontSize: 11.5,
    letterSpacing: 2.4,
  },
  statsWrap: {
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    paddingVertical: spacing.lg + 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    ...font.serif,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
  },
  statLabel: {
    ...t.caption,
    fontSize: 11.5,
  },
});
