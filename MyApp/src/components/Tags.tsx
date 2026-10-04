import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { border, colors, fontSize, priorityColors, priorityLabels, radius, spacing } from '../theme';
import type { TaskPriority } from '../modules/tasks/tasksApi';

function pillStyle(color: string) {
  return StyleSheet.flatten([styles.pill, { backgroundColor: color }]);
}

export function PriorityTag({ priority }: { priority: TaskPriority }) {
  const color = priorityColors[priority];
  return (
    <View style={pillStyle(color)}>
      <Text style={styles.pillText}>{priorityLabels[priority]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
