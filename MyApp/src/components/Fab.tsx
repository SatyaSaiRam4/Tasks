import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { border, colors, radius } from '../theme';

interface FabProps {
  onPress: () => void;
  glyph?: string;
  accessibilityLabel?: string;
}

/** Floating "quick add" action button — a bold ink-outlined disc with a hard offset shadow. */
export function Fab({ onPress, glyph = '+', accessibilityLabel = 'Quick add' }: FabProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.shadowBlock} />
      <TouchableOpacity
        style={styles.fab}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={styles.glyph}>{glyph}</Text>
      </TouchableOpacity>
    </View>
  );
}

const SIZE = 60;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: SIZE,
    height: SIZE,
  },
  shadowBlock: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: border.thick,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  glyph: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '800',
    marginTop: -2,
  },
});
