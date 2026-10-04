import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, GUTTER } from '../theme';
import { Glow } from './Gradient';
import { OfflineBanner } from './OfflineBanner';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  /** Tints the ambient top glow, e.g. the Vault uses a deeper violet. */
  glowColor?: string;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  footer?: React.ReactNode;
}

/**
 * Every screen's chrome: the near-black background with a faint ambient
 * glow at the top, safe areas, an offline banner, and an optional scroll
 * container with pull-to-refresh.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
  refreshing = false,
  onRefresh,
  edges = ['top'],
  glowColor = colors.primary,
  keyboardShouldPersistTaps = 'handled',
  footer,
}: ScreenProps) {
  const inner = [padded && styles.padded, contentStyle];

  // Only show the spinner for a refresh the user pulled for. `refreshing` is
  // usually a query's isFetching, which also flips on background refetches,
  // and on Android a spinner toggled that way can get stuck on screen.
  const [pulled, setPulled] = useState(false);
  useEffect(() => {
    if (!pulled || refreshing) return;
    // A short grace period lets the refetch start before we decide it's done.
    const timer = setTimeout(() => setPulled(false), 400);
    return () => clearTimeout(timer);
  }, [pulled, refreshing]);
  const handleRefresh = onRefresh
    ? () => {
        setPulled(true);
        onRefresh();
      }
    : undefined;
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <Glow color={glowColor} size={520} intensity={0.16} style={styles.ambient} />
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, ...inner]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          refreshControl={
            handleRefresh ? (
              <RefreshControl
                refreshing={pulled}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surfaceAlt}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, ...inner]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  ambient: {
    position: 'absolute',
    top: -300,
    alignSelf: 'center',
  },
  fill: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: GUTTER,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
});
