import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { ErrorState } from '../../../components/ErrorState';
import { SectionCard } from '../../../components/SectionCard';
import { Panel } from '../../../components/Panel';
import { Fab } from '../../../components/Fab';
import { PriorityTag } from '../../../components/Tags';
import { border, colors, fontSize, radius, spacing, typography } from '../../../theme';
import { formatDateTime, isSameDay, parseIso } from '../../../utils/date';
import { getErrorMessage } from '../../../utils/apiError';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { useCompleteTaskMutation, useListTasksQuery } from '../../tasks/tasksApi';
import { useListNotesQuery } from '../../notes/notesApi';
import { useListRemindersQuery } from '../../reminders/remindersApi';
import Toast from '@ant-design/react-native/lib/toast';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAppSelector(selectCurrentUser);

  const tasksQuery = useListTasksQuery({ status_filter: 'PENDING' });
  const notesQuery = useListNotesQuery({ include_archived: false });
  const remindersQuery = useListRemindersQuery();
  const [completeTask] = useCompleteTaskMutation();

  const isLoading = tasksQuery.isLoading || notesQuery.isLoading || remindersQuery.isLoading;
  const isError = tasksQuery.isError || notesQuery.isError || remindersQuery.isError;

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingView label="Getting things ready…" />
      </ScreenContainer>
    );
  }

  if (isError || !tasksQuery.data || !notesQuery.data || !remindersQuery.data) {
    return (
      <ScreenContainer>
        <ErrorState
          message={getErrorMessage(
            tasksQuery.error ?? notesQuery.error ?? remindersQuery.error,
            'Could not load your dashboard.',
          )}
          onRetry={() => {
            tasksQuery.refetch();
            notesQuery.refetch();
            remindersQuery.refetch();
          }}
        />
      </ScreenContainer>
    );
  }

  const tasks = tasksQuery.data;
  const now = new Date();
  const todaysTasks = tasks
    .filter(t => {
      const d = parseIso(t.scheduled_at);
      return d && isSameDay(d, now);
    })
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));

  const upcoming = tasks
    .filter(t => {
      const d = parseIso(t.scheduled_at);
      return d && d.getTime() > now.getTime() && !isSameDay(d, now);
    })
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
    .slice(0, 3);

  const todaySection = todaysTasks.length > 0 ? todaysTasks : upcoming;
  const todaySectionLabel = todaysTasks.length > 0 ? 'Today' : 'Coming up';

  const pinnedNotes = notesQuery.data.filter(n => n.pinned).slice(0, 3);
  const recentNote = notesQuery.data[0];
  const nextReminder = [...remindersQuery.data].sort((a, b) => a.remind_at.localeCompare(b.remind_at))[0];

  const handleQuickComplete = async (taskId: string) => {
    try {
      await completeTask(taskId).unwrap();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not complete task.'));
    }
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.greeting}>{greeting()}{user ? `, ${user.display_name.split(' ')[0]}` : ''}</Text>
        <Text style={styles.heroSubtitle}>
          {tasks.length === 0
            ? "You're all caught up."
            : `${tasks.length} pending task${tasks.length === 1 ? '' : 's'} on your mind.`}
        </Text>
      </View>

      <SectionCard title={todaySectionLabel} subtitle={todaySection.length ? undefined : 'Nothing scheduled — enjoy the quiet.'}>
        {todaySection.length === 0 ? (
          <TouchableOpacity style={styles.inlineAdd} onPress={() => navigation.navigate('CreateEditTask', {})}>
            <Text style={styles.inlineAddText}>+ Schedule something</Text>
          </TouchableOpacity>
        ) : (
          todaySection.map(task => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskRow}
              onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              activeOpacity={0.85}
            >
              <TouchableOpacity
                style={styles.taskCheck}
                onPress={() => handleQuickComplete(task.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              />
              <View style={styles.taskBody}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                {task.scheduled_at ? <Text style={styles.taskTime}>{formatDateTime(task.scheduled_at)}</Text> : null}
              </View>
              <PriorityTag priority={task.priority} />
            </TouchableOpacity>
          ))
        )}
      </SectionCard>

      {nextReminder ? (
        <SectionCard title="Next reminder">
          <TouchableOpacity
            style={styles.noteRow}
            onPress={() => navigation.navigate('CreateEditReminder', { reminderId: nextReminder.id })}
            activeOpacity={0.85}
          >
            <Text style={styles.reminderTime}>{formatDateTime(nextReminder.remind_at)}</Text>
            <Text style={styles.noteContent} numberOfLines={1}>
              {nextReminder.title}
            </Text>
          </TouchableOpacity>
        </SectionCard>
      ) : null}

      {pinnedNotes.length > 0 ? (
        <SectionCard title="Pinned notes">
          {pinnedNotes.map(note => (
            <TouchableOpacity
              key={note.id}
              style={styles.noteRow}
              onPress={() => navigation.navigate('NoteEditor', { noteId: note.id })}
              activeOpacity={0.85}
            >
              <Text style={styles.noteContent} numberOfLines={2}>
                {note.content}
              </Text>
            </TouchableOpacity>
          ))}
        </SectionCard>
      ) : recentNote ? (
        <SectionCard title="Recent note">
          <TouchableOpacity
            style={styles.noteRow}
            onPress={() => navigation.navigate('NoteEditor', { noteId: recentNote.id })}
            activeOpacity={0.85}
          >
            <Text style={styles.noteContent} numberOfLines={2}>
              {recentNote.content}
            </Text>
          </TouchableOpacity>
        </SectionCard>
      ) : null}

      <View style={styles.quickLinks}>
        <TouchableOpacity
          style={styles.quickLinkWrap}
          onPress={() => navigation.navigate('CreateEditTask', {})}
          activeOpacity={0.85}
        >
          <Panel contentStyle={styles.quickLink}>
            <Text style={styles.quickLinkGlyph}>📝</Text>
            <Text style={styles.quickLinkLabel}>Task</Text>
          </Panel>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLinkWrap}
          onPress={() => navigation.navigate('CreateEditReminder', {})}
          activeOpacity={0.85}
        >
          <Panel contentStyle={styles.quickLink} backgroundColor={colors.accentBlueSoft}>
            <Text style={styles.quickLinkGlyph}>◷</Text>
            <Text style={styles.quickLinkLabel}>Reminder</Text>
          </Panel>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLinkWrap}
          onPress={() => navigation.navigate('NoteEditor', {})}
          activeOpacity={0.85}
        >
          <Panel contentStyle={styles.quickLink} backgroundColor={colors.accentYellowSoft}>
            <Text style={styles.quickLinkGlyph}>🧠</Text>
            <Text style={styles.quickLinkLabel}>Note</Text>
          </Panel>
        </TouchableOpacity>
      </View>

      <Fab onPress={() => navigation.navigate('CreateEditTask', {})} accessibilityLabel="Quick add task" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  hero: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.h1,
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  inlineAdd: {
    paddingVertical: spacing.sm,
  },
  inlineAddText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: border.thick,
    borderColor: colors.ink,
    marginRight: spacing.md,
  },
  taskBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  taskTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  taskTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  noteRow: {
    paddingVertical: spacing.sm,
  },
  reminderTime: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  noteContent: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 19,
  },
  quickLinks: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  quickLinkWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  quickLink: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  quickLinkGlyph: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  quickLinkLabel: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
