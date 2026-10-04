import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Edges to apply safe-area padding to. Defaults to top only, since tab/stack headers usually handle the rest. */
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
}

/** The tri-color accent stripe rendered at the top of every single screen — the one
 * recurring identity mark that ties the login screen to the deepest detail screen. */
function AccentStripe() {
  return (
    <View style={styles.stripe}>
      <View style={[styles.stripeSegment, { backgroundColor: colors.primary }]} />
      <View style={[styles.stripeSegment, { backgroundColor: colors.accentOrange }]} />
      <View style={[styles.stripeSegment, { backgroundColor: colors.accentBlue }]} />
    </View>
  );
}

/**
 * Consistent screen chrome: the brand accent stripe, background color, and
 * safe area handling, with an optional scroll container and pull-to-refresh.
 */
export function ScreenContainer({
  children,
  scroll = false,
  style,
  contentStyle,
  refreshing,
  onRefresh,
  edges = ['top'],
}: ScreenContainerProps) {
  if (scroll) {
    return (
      <SafeAreaView style={[styles.container, style]} edges={edges}>
        <AccentStripe />
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      <AccentStripe />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  stripe: {
    flexDirection: 'row',
    height: 5,
  },
  stripeSegment: {
    flex: 1,
  },
});
