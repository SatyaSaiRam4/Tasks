import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Avatar } from '../../../components/Controls';
import { EmptyState, FadeIn } from '../../../components/Feedback';
import { Gradient } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { errorStatus, getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { useLazySearchUserQuery } from '../../users/usersApi';
import { achievementIcon } from '../../streaks/screens/AchievementsScreen';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const me = useAppSelector(selectCurrentUser);
  const [id, setId] = useState('');
  const [search, { data, error, isFetching, isError, isUninitialized }] = useLazySearchUserQuery();

  const submit = () => {
    const value = id.trim().toUpperCase();
    if (value.length >= 3) search(value);
  };

  return (
    <Screen>
      <ScreenHeader title="Discover" />
      <Text style={[t.body, styles.intro]}>
        Search for someone by their User ID to see the consistency they’ve chosen to share. Nothing private is ever shown.
      </Text>
      <TextField
        label="User ID"
        icon="search"
        value={id}
        onChangeText={v => setId(v.toUpperCase())}
        placeholder="SATYA_8F29A"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={submit}
      />
      <Button label="Search" icon="search" onPress={submit} loading={isFetching} disabled={id.trim().length < 3} />

      <View style={styles.result}>
        {isUninitialized ? (
          <Card>
            <View style={styles.row}>
              <Icon name="info" size={18} color={colors.textTertiary} />
              <Text style={[t.caption, styles.flex]}>
                Your ID is <Text style={{ color: colors.text, fontWeight: '700' }}>{me?.public_id}</Text>. Turn on a public
                profile in Settings → Privacy if you want others to find you.
              </Text>
            </View>
          </Card>
        ) : isError ? (
          <EmptyState
            icon="users"
            title={errorStatus(error) === 404 ? 'No public profile found' : 'Search failed'}
            message={errorStatus(error) === 404 ? 'Check the ID, or the person may keep their profile private.' : getErrorMessage(error)}
          />
        ) : data ? (
          <FadeIn>
            <Gradient colors={gradients.surface} borderRadius={radius.xl} style={styles.profile}>
              <Avatar name={data.display_name} emoji={data.avatar} size={68} />
              <Text style={[t.title, styles.center]}>{data.display_name}</Text>
              <Text style={styles.id}>{data.public_id}</Text>
              <Text style={t.caption}>Member since {formatFullDate(data.member_since)}</Text>
              <View style={styles.stats}>
                {data.current_streak !== null ? <Stat icon="flame" color={colors.streak} label="Streak" value={String(data.current_streak)} /> : null}
                {data.best_streak !== null ? <Stat icon="trophy" color={colors.streakGold} label="Best" value={String(data.best_streak)} /> : null}
                <Stat icon="zap" color={colors.success} label="Consistency" value={`${Math.round(data.consistency_pct)}%`} />
                <Stat icon="flag" color={colors.info} label="Tracks" value={String(data.completed_tracks)} />
              </View>
              {data.achievements?.length ? (
                <View style={styles.badges}>
                  {data.achievements.slice(0, 6).map(a => (
                    <View key={a.code} style={styles.badge} accessible accessibilityLabel={a.title}>
                      <Gradient colors={gradients.streak} borderRadius={radius.md} style={styles.badgeIcon}>
                        <Icon name={achievementIcon(a.icon)} size={18} color={colors.white} />
                      </Gradient>
                      <Text style={styles.badgeText} numberOfLines={2}>
                        {a.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Gradient>
          </FadeIn>
        ) : null}
      </View>
      {!isUninitialized ? null : (
        <Button label="Privacy settings" variant="ghost" onPress={() => navigation.navigate('Settings')} />
      )}
    </Screen>
  );
}

function Stat({ icon, color, label, value }: { icon: 'flame' | 'trophy' | 'zap' | 'flag'; color: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={16} color={color} />
      <Text style={t.heading}>{value}</Text>
      <Text style={t.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  intro: {
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  result: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  profile: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  id: {
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  badge: {
    width: 70,
    alignItems: 'center',
    gap: 4,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
});
