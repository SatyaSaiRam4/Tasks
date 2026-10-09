import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Medallion, SectionHeader } from '../../../components/Controls';
import { Button } from '../../../components/Button';
import { AnimatedNumber } from '../../../components/Progress';
import { ErrorState, SkeletonList } from '../../../components/Feedback';
import { type IconName } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { useLayout } from '../../../hooks/useLayout';
import { useGetAdminDashboardQuery } from '../adminApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AdminDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetAdminDashboardQuery();

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <ScreenHeader title="Admin" subtitle="System overview" />
      <Text style={styles.intro}>Live totals across every account. Private Vault content is never visible here.</Text>
      {isLoading ? (
        <SkeletonList count={6} height={80} />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error, 'Could not load admin stats.')} onRetry={refetch} />
      ) : (
        <>
          <SectionHeader title="Users" style={styles.first} />
          <View style={styles.grid}>
            <Tile icon="users" label="Total users" value={data.total_users} color={colors.primary} />
            <Tile icon="check-circle" label="Active" value={data.active_users} color={colors.success} />
            <Tile icon="shield" label="Admins" value={data.admin_users} color={colors.warning} />
          </View>

          <SectionHeader title="Consistency" />
          <View style={styles.grid}>
            <Tile icon="target" label="Plans" value={data.total_tracks} color={colors.info} />
            <Tile icon="list" label="Tasks" value={data.total_actions} color={colors.primary} />
            <Tile icon="zap" label="Completions (24h)" value={data.completions_today} color={colors.success} />
            <Tile icon="check" label="All completions" value={data.total_completions} color={colors.success} />
            <Tile icon="flame" label="Avg. streak" value={Math.round(data.avg_current_streak)} color={colors.streak} />
            <Tile icon="trophy" label="Top best streak" value={data.max_best_streak} color={colors.streakGold} />
          </View>

          <SectionHeader title="Reminder delivery" />
          <View style={styles.grid}>
            <Tile icon="bell" label="Active reminders" value={data.reminders_active} color={colors.primary} />
            <Tile icon="message" label="WhatsApp sent" value={data.whatsapp_sent} color={colors.success} />
            <Tile icon="alert" label="WhatsApp failed" value={data.whatsapp_failed} color={colors.danger} />
            <Tile icon="clock" label="WhatsApp queued" value={data.whatsapp_pending} color={colors.info} />
          </View>

          <Card tone="glass" style={styles.vault}>
            <View style={styles.row}>
              <Medallion icon="lock" size={38} color={colors.violet} />
              <Text style={[t.caption, styles.flex]}>
                {data.vault_entries} Vault entries exist. Admins can see this count only. Vault content is encrypted and never
                available here.
              </Text>
            </View>
          </Card>

          <Button label="Manage users" icon="users" iconRight="chevron-right" onPress={() => navigation.navigate('AdminUsers')} style={styles.cta} />
        </>
      )}
    </Screen>
  );
}

function Tile({ icon, label, value, color }: { icon: IconName; label: string; value: number; color: string }) {
  const { isPhone } = useLayout();
  return (
    <Card style={[styles.tile, isPhone && styles.tilePhone]} contentStyle={styles.tileContent}>
      <Medallion icon={icon} size={34} color={color} />
      <AnimatedNumber value={value} style={styles.value} />
      <Text style={t.caption}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  first: {
    marginTop: spacing.sm,
  },
  intro: {
    ...t.aside,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '31%',
    flexGrow: 1,
  },
  tilePhone: {
    width: '47%',
  },
  tileContent: {
    padding: spacing.lg,
    gap: 6,
  },
  value: {
    ...font.serif,
    fontSize: 30,
    lineHeight: 34,
    color: colors.goldBright,
  },
  vault: {
    marginTop: spacing.xl,
  },
  cta: {
    marginTop: spacing.xl,
  },
});
