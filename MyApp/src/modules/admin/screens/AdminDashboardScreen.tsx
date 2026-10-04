import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { ErrorState } from '../../../components/ErrorState';
import { StatCard } from '../../../components/StatCard';
import { AppButton } from '../../../components/AppButton';
import { colors, spacing, typography } from '../../../theme';
import { getErrorMessage } from '../../../utils/apiError';
import { useGetAdminDashboardQuery } from '../adminApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AdminDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isError, error, refetch } = useGetAdminDashboardQuery();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingView label="Loading dashboard…" />;
  } else if (isError || !data) {
    body = <ErrorState message={getErrorMessage(error, 'Could not load the dashboard.')} onRetry={refetch} />;
  } else {
    const completionRate = data.total_tasks > 0 ? Math.round((data.completed_tasks / data.total_tasks) * 100) : 0;
    body = (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.grid}>
          <StatCard label="Total users" value={data.total_users} accentColor={colors.primary} glyph="👥" />
          <StatCard label="Active users" value={data.active_users} accentColor={colors.success} glyph="✅" />
          <StatCard label="Admins" value={data.admin_users} accentColor={colors.warning} glyph="🛡️" />
          <StatCard label="Categories" value={data.total_categories} accentColor={colors.info} glyph="🗂️" />
          <StatCard label="Total tasks" value={data.total_tasks} accentColor={colors.primary} glyph="📝" />
          <StatCard label="Completed tasks" value={data.completed_tasks} accentColor={colors.success} glyph="🎯" />
          <StatCard label="Notes" value={data.total_notes} accentColor="#B23CF0" glyph="🧠" />
          <StatCard label="Completion rate" value={`${completionRate}%`} accentColor={colors.warning} glyph="📈" />
        </View>

        <AppButton label="Manage users ›" variant="secondary" onPress={() => navigation.navigate('AdminUsers')} style={styles.usersButton} />
      </ScrollView>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin</Text>
        <Text style={styles.headerSubtitle}>Rememberly at a glance</Text>
      </View>
      {body}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h1,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  usersButton: {
    marginTop: spacing.sm,
  },
});
