import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { Fab } from '../../../components/Fab';
import { Panel } from '../../../components/Panel';
import { colors, fontSize, spacing, typography } from '../../../theme';
import { formatDayLabel, isSameDay, parseIso } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import { useListNotesQuery, usePinNoteMutation, useUnpinNoteMutation, type NoteOut } from '../notesApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Buckets a note's date into a simple, readable group — date-wise, without needing a calendar view. */
function dateBucket(iso: string): string {
  const d = parseIso(iso);
  if (!d) return 'Earlier';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  if (d.getTime() >= weekAgo.getTime()) return 'This week';
  return 'Earlier';
}

function NoteCard({ note, onPress, onTogglePin }: { note: NoteOut; onPress: () => void; onTogglePin: () => void }) {
  return (
    <TouchableOpacity style={styles.cardWrap} onPress={onPress} activeOpacity={0.85}>
      <Panel contentStyle={styles.card} shadowOffset={4} backgroundColor={note.pinned ? colors.accentYellowSoft : colors.surface}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{formatDayLabel(note.updated_at)}</Text>
          <TouchableOpacity onPress={onTogglePin} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.pinGlyph, note.pinned && styles.pinGlyphActive]}>{note.pinned ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>
        {note.title ? (
          <Text style={styles.cardTitle} numberOfLines={1}>
            {note.title}
          </Text>
        ) : null}
        <Text style={styles.cardContent} numberOfLines={3}>
          {note.content}
        </Text>
      </Panel>
    </TouchableOpacity>
  );
}

export function NotesScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isFetching, isError, error, refetch } = useListNotesQuery({ include_archived: false });
  const [pinNote] = usePinNoteMutation();
  const [unpinNote] = useUnpinNoteMutation();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleTogglePin = async (note: NoteOut) => {
    try {
      if (note.pinned) {
        await unpinNote(note.id).unwrap();
      } else {
        await pinNote(note.id).unwrap();
      }
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not update note.'));
    }
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingView label="Loading notes…" />;
  } else if (isError) {
    body = <ErrorState message={getErrorMessage(error, 'Could not load notes.')} onRetry={refetch} />;
  } else if (!data || data.length === 0) {
    body = (
      <EmptyState
        glyph="🧠"
        title="No notes yet"
        subtitle="Write anything you want to keep — passwords, account details, ideas. Organized by date automatically."
        actionLabel="Add note"
        onAction={() => navigation.navigate('NoteEditor', {})}
      />
    );
  } else {
    const pinned = data.filter(n => n.pinned);
    const rest = data.filter(n => !n.pinned);

    const buckets: Record<string, NoteOut[]> = {};
    for (const note of rest) {
      const key = dateBucket(note.updated_at);
      (buckets[key] ??= []).push(note);
    }

    const sections: { header: string; items: NoteOut[] }[] = [];
    if (pinned.length) sections.push({ header: 'Pinned', items: pinned });
    for (const header of ['Today', 'Yesterday', 'This week', 'Earlier']) {
      if (buckets[header]?.length) sections.push({ header, items: buckets[header] });
    }

    body = (
      <FlatList
        data={sections}
        keyExtractor={(_, i) => `section-${i}`}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing || isFetching}
        onRefresh={handleRefresh}
        renderItem={({ item: section }) => (
          <View>
            {section.header ? <Text style={styles.sectionHeader}>{section.header}</Text> : null}
            {section.items.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onPress={() => navigation.navigate('NoteEditor', { noteId: note.id })}
                onTogglePin={() => handleTogglePin(note)}
              />
            ))}
          </View>
        )}
      />
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notes</Text>
        <Text style={styles.headerSubtitle}>Anything worth writing down</Text>
      </View>
      {body}
      <Fab onPress={() => navigation.navigate('NoteEditor', {})} accessibilityLabel="Add note" />
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
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinGlyph: {
    fontSize: fontSize.lg,
    color: colors.textFaint,
  },
  pinGlyphActive: {
    color: colors.pin,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  cardContent: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 19,
  },
  cardDate: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
});
