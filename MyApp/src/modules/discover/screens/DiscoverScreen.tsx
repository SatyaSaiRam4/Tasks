import React, { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand, colors, font, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Avatar, Chip, IconButton, Toggle } from '../../../components/Controls';
import { EmptyState, FadeIn, Skeleton } from '../../../components/Feedback';
import { Gradient } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { errorStatus, getErrorMessage } from '../../../utils/apiError';
import { useGetMeQuery, useLazySearchUserQuery, useUpdateSettingsMutation } from '../../users/usersApi';
import { AchievementBadge } from '../../streaks/screens/AchievementsScreen';

const RECENT_KEY = '@rememberly/recent_friend_searches';

/** Search: find another user by their User ID and see their streak; below, your own ID. */
export function DiscoverScreen() {
  const me = useGetMeQuery();
  const [updateSettings] = useUpdateSettingsMutation();
  const [id, setId] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [search, { data, error, isFetching, isError, isUninitialized }] = useLazySearchUserQuery();
  const isPublic = Boolean(me.data?.settings.is_public_profile);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then(raw => raw && setRecent(JSON.parse(raw)))
      .catch(() => undefined);
  }, []);

  const run = (value: string) => {
    const clean = value.trim().toUpperCase();
    if (clean.length < 3) return;
    setId(clean);
    search(clean);
    const next = [clean, ...recent.filter(r => r !== clean)].slice(0, 5);
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  return (
    <Screen>
      <ScreenHeader title="Search" />

      {/* Search */}
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.gold} strokeWidth={1.7} />
        <TextInput
          value={id}
          onChangeText={v => setId(v.toUpperCase())}
          placeholder="Search a User ID, e.g. SATYA_8F29A"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => run(id)}
          style={styles.searchInput}
          accessibilityLabel="Friend's User ID"
        />
        <Pressable
          onPress={() => run(id)}
          disabled={id.trim().length < 3}
          style={[styles.go, id.trim().length < 3 && styles.goOff]}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Icon name="arrow-right" size={18} color={colors.onPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>
      {recent.length && isUninitialized ? (
        <View style={styles.recent}>
          {recent.map(r => (
            <Chip key={r} label={r} icon="refresh" onPress={() => run(r)} />
          ))}
        </View>
      ) : null}

      {/* Result */}
      <View style={styles.result}>
        {isFetching ? (
          <Skeleton height={220} rounded={radius.xl} />
        ) : isError ? (
          <EmptyState
            compact
            icon="users"
            title={errorStatus(error) === 404 ? 'No one found' : 'Search failed'}
            message={errorStatus(error) === 404 ? 'Check the ID. Your friend may also need to turn on “Let friends find me”.' : getErrorMessage(error)}
          />
        ) : data ? (
          <FadeIn>
            <Card>
              <View style={styles.row}>
                <Avatar name={data.display_name} emoji={data.avatar} photo={data.photo_url} size={52} />
                <View style={styles.flex}>
                  <Text style={t.heading}>{data.display_name}</Text>
                  <Text style={styles.publicId}>{data.public_id}</Text>
                </View>
              </View>

              {data.current_streak !== null || data.best_streak !== null ? (
                <Gradient colors={gradients.hero} direction="diagonal" borderRadius={radius.lg} style={styles.streak}>
                  <Icon name="flame" size={28} color={brand.ember} strokeWidth={1.6} />
                  {data.current_streak !== null ? (
                    <Text style={styles.streakNum}>
                      {data.current_streak} <Text style={styles.streakUnit}>streak</Text>
                    </Text>
                  ) : null}
                  {data.best_streak !== null ? <Text style={[t.caption, styles.best]}>Best {data.best_streak}</Text> : null}
                </Gradient>
              ) : (
                <Text style={[t.caption, styles.hidden]}>{data.display_name.split(' ')[0]} keeps their streak private.</Text>
              )}

              {data.achievements?.length ? (
                <View style={styles.badges}>
                  {data.achievements.slice(0, 6).map(a => (
                    <View key={a.code} style={styles.badge} accessible accessibilityLabel={a.title}>
                      <AchievementBadge icon={a.icon} size={46} />
                      <Text style={styles.badgeText} numberOfLines={2}>
                        {a.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          </FadeIn>
        ) : null}
      </View>
      {/* Your own ID, and whether friends can find you */}
      <Card tone="hero" style={styles.own}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[t.micro, { color: brand.champagne }]}>Your ID</Text>
            {me.data ? <Text style={styles.myId}>{me.data.public_id}</Text> : <Skeleton width={160} height={26} style={styles.myIdSkeleton} />}
          </View>
          <IconButton
            icon="copy"
            color={colors.heroText}
            style={styles.heroButton}
            accessibilityLabel="Share your ID"
            onPress={() => me.data && Share.share({ message: `Find me on Memo: ${me.data.public_id}` })}
          />
        </View>
        <View style={[styles.row, styles.toggleRow]}>
          <View style={styles.flex}>
            <Text style={[t.bodyStrong, { color: colors.heroText }]}>Let friends find me</Text>
            <Text style={[t.caption, { color: colors.heroTextSecondary }]}>{isPublic ? 'Friends can see your streak.' : 'Nobody can find you right now.'}</Text>
          </View>
          <Toggle
            value={isPublic}
            onChange={v => updateSettings({ is_public_profile: v })}
            accessibilityLabel="Let friends find me"
          />
        </View>
      </Card>

    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  own: {
    marginTop: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroButton: {
    backgroundColor: colors.heroGlass,
    borderColor: colors.heroLine,
  },
  myId: {
    ...t.heading,
    fontSize: 26,
    lineHeight: 30,
    color: brand.champagneLight,
    letterSpacing: 1.4,
    marginTop: 4,
  },
  myIdSkeleton: {
    marginTop: 6,
  },
  publicId: {
    ...font.bold,
    fontSize: 11.5,
    letterSpacing: 1.8,
    color: colors.gold,
    marginTop: 2,
  },
  toggleRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.heroLine,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 58,
    paddingLeft: spacing.lg + 2,
    paddingRight: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
  },
  searchInput: {
    ...font.semibold,
    flex: 1,
    color: colors.text,
    letterSpacing: 0.5,
    paddingVertical: 0,
  },
  go: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFill,
  },
  goOff: {
    opacity: 0.35,
  },
  recent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  result: {
    marginTop: spacing.xl,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
  },
  streakNum: {
    ...font.serif,
    flex: 1,
    fontSize: 36,
    lineHeight: 40,
    color: brand.champagneLight,
  },
  streakUnit: {
    ...font.serifItalic,
    fontSize: 16,
    color: colors.heroTextSecondary,
  },
  best: {
    ...font.bold,
    color: brand.champagne,
  },
  hidden: {
    marginTop: spacing.lg,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  badge: {
    width: 64,
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    ...t.caption,
    fontSize: 11,
    textAlign: 'center',
  },
});
