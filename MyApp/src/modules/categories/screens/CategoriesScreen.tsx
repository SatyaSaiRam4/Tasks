import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from '@ant-design/react-native/lib/modal';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { Fab } from '../../../components/Fab';
import { Panel } from '../../../components/Panel';
import { border, colors, fontSize, radius, spacing, typography } from '../../../theme';
import { useCreateCategoryMutation, useListCategoriesQuery, type CategoryOut } from '../categoriesApi';
import { useListTasksQuery } from '../../tasks/tasksApi';
import { getErrorMessage } from '../../../utils/apiError';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PALETTE = [colors.primary, colors.accentOrange, colors.accentBlue, colors.success, colors.accentYellow, '#B23CF0'];

function colorForIndex(index: number): string {
  return PALETTE[index % PALETTE.length];
}

function CategoryCard({
  category,
  accent,
  taskCount,
  onPress,
}: {
  category: CategoryOut;
  accent: string;
  taskCount: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.cardWrap} onPress={onPress} activeOpacity={0.85}>
      <Panel contentStyle={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: accent }]}>
          <Text style={styles.iconGlyph}>{(category.icon || category.name[0] || '•').slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={styles.cardSubtitle}>
          {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        </Text>
      </Panel>
    </TouchableOpacity>
  );
}

export function CategoriesScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isLoading, isFetching, isError, error, refetch } = useListCategoriesQuery({ includeArchived: false });
  const { data: tasks } = useListTasksQuery();
  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [refreshing, setRefreshing] = useState(false);

  const taskCountByCategory = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of tasks ?? []) {
      if (!task.category_id) continue;
      map[task.category_id] = (map[task.category_id] ?? 0) + 1;
    }
    return map;
  }, [tasks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openCreatePrompt = () => {
    Modal.prompt(
      'New category',
      'What would you like to remember things about?',
      async name => {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        try {
          await createCategory({ name: trimmed }).unwrap();
        } catch (err) {
          Toast.fail(getErrorMessage(err, 'Could not create category.'));
        }
      },
      'default',
      '',
      ['e.g. Work, Health, Home'],
    );
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingView label="Loading categories…" />;
  } else if (isError) {
    body = <ErrorState message={getErrorMessage(error, 'Could not load categories.')} onRetry={refetch} />;
  } else if (!data || data.length === 0) {
    body = (
      <EmptyState
        glyph="🗂️"
        title="No categories yet"
        subtitle="Categories group your tasks, checklists and notes — try adding one to get started."
        actionLabel="Add category"
        onAction={openCreatePrompt}
      />
    );
  } else {
    body = (
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing || isFetching}
        onRefresh={handleRefresh}
        renderItem={({ item, index }) => (
          <CategoryCard
            category={item}
            accent={colorForIndex(index)}
            taskCount={taskCountByCategory[item.id] ?? 0}
            onPress={() => navigation.navigate('CategoryDetail', { categoryId: item.id, categoryName: item.name })}
          />
        )}
      />
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
        <Text style={styles.headerSubtitle}>Your recurring checklists, organized</Text>
      </View>
      {body}
      <Fab onPress={openCreatePrompt} accessibilityLabel="Add category" />
      {isCreating ? <LoadingView label="Creating…" fullscreen={false} /> : null}
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
  row: {
    justifyContent: 'space-between',
  },
  cardWrap: {
    width: '48%',
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.lg,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconGlyph: {
    fontSize: fontSize.lg,
    fontWeight: '900',
    color: colors.ink,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.ink,
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
});
