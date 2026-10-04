import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { Fab } from '../../../components/Fab';
import { Panel } from '../../../components/Panel';
import { border, colors, fontSize, radius, spacing } from '../../../theme';
import { formatDayLabel, formatTime, parseIso } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import { useListRemindersQuery, type ReminderOut } from '../remindersApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function whatsAppChip(reminder: ReminderOut) {
  if (!reminder.whatsapp_number) return null;
  const label =
    reminder.whatsapp_status === 'SENT'
      ? 'WhatsApp sent'
      : reminder.whatsapp_status === 'FAILED'
        ? 'WhatsApp failed'
        : 'WhatsApp queued';
  const tone =
    reminder.whatsapp_status === 'SENT'
      ? colors.success
      : reminder.whatsapp_status === 'FAILED'
        ? colors.danger
        : colors.accentBlue;
  return (
    <View style={[chipStyles.chip, { backgroundColor: tone }]}>
      <Text style={chipStyles.chipText}>{label}</Text>
    </View>
  );
}

function ReminderRow({ reminder, onPress }: { reminder: ReminderOut; onPress: () => void }) {
  const date = parseIso(reminder.remind_at);
  const isPast = date ? date.getTime() < Date.now() : false;

  return (
    <TouchableOpacity style={styles.rowWrap} onPress={onPress} activeOpacity={0.85}>
      <Panel contentStyle={styles.row} shadowOffset={4}>
        <View style={[styles.timeBadge, isPast && styles.timeBadgePast]}>
          <Text style={styles.timeBadgeDay}>{formatDayLabel(reminder.remind_at)}</Text>
          <Text style={styles.timeBadgeTime}>{formatTime(reminder.remind_at)}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {reminder.title}
          </Text>
          {reminder.note ? (
            <Text style={styles.rowNote} numberOfLines={2}>
              {reminder.note}
            </Text>
          ) : null}
          {whatsAppChip(reminder)}
        </View>
      </Panel>
    </TouchableOpacity>
  );
}

export function RemindersScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isFetching, isError, error, refetch } = useListRemindersQuery();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingView label="Loading reminders…" />;
  } else if (isError) {
    body = <ErrorState message={getErrorMessage(error, 'Could not load reminders.')} onRetry={refetch} />;
  } else if (!data || data.length === 0) {
    body = (
      <EmptyState
        glyph="⏰"
        title="No reminders yet"
        subtitle="Add one for anything time-based — 'Go to market at 4pm' or a date months away."
        actionLabel="Add reminder"
        onAction={() => navigation.navigate('CreateEditReminder', {})}
      />
    );
  } else {
    const sorted = [...data].sort((a, b) => a.remind_at.localeCompare(b.remind_at));
    body = (
      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing || isFetching}
        onRefresh={handleRefresh}
        renderItem={({ item }) => (
          <ReminderRow reminder={item} onPress={() => navigation.navigate('CreateEditReminder', { reminderId: item.id })} />
        )}
      />
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reminders</Text>
        <Text style={styles.headerSubtitle}>A notification at the right time, every time</Text>
      </View>
      {body}
      <Fab onPress={() => navigation.navigate('CreateEditReminder', {})} accessibilityLabel="Add reminder" />
    </ScreenContainer>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '900',
    color: colors.ink,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  rowWrap: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  timeBadge: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    backgroundColor: colors.accentBlueSoft,
    paddingVertical: spacing.sm,
    marginRight: spacing.md,
  },
  timeBadgePast: {
    backgroundColor: colors.surfaceAlt,
  },
  timeBadgeDay: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
  },
  timeBadgeTime: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.ink,
  },
  rowNote: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
});
