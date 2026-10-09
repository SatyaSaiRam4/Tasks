import React, { useEffect, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, CONTENT_MAX_WIDTH, spacing, WIDE_CONTENT_MAX_WIDTH } from '../theme';
import { useLayout } from '../hooks/useLayout';
import { Backdrop } from '../layouts/Backdrop';
import { OfflineBanner } from './OfflineBanner';
import { riseStyle, useFocusEntrance } from '../animations';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  /** Tints the main pool of ambient light, e.g. the Vault uses the accent. */
  glowColor?: string;
  /** Dashboard-style screens get a wider column on tablets and desktops. */
  wide?: boolean;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  footer?: React.ReactNode;
}

/**
 * Shared screen chrome: the cinematic backdrop, safe areas, an offline
 * banner, an entrance as the screen comes into view, and an optional scroll
 * container with pull-to-refresh. Content is
 * centered in a capped column on large screens.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
  refreshing = false,
  onRefresh,
  edges = ['top'],
  glowColor,
  wide = false,
  keyboardShouldPersistTaps = 'handled',
  footer,
}: ScreenProps) {
  const { gutter, hasRail } = useLayout();
  // Content rises in from below whenever the screen comes into view.
  const enter = useFocusEntrance();
  const body = <Animated.View style={[styles.fill, riseStyle(enter, 28)]}>{children}</Animated.View>;
  const frame: ViewStyle = {
    width: '100%',
    maxWidth: (wide ? WIDE_CONTENT_MAX_WIDTH : CONTENT_MAX_WIDTH) + gutter * 2,
    alignSelf: 'center',
  };
  const inner = [frame, padded && { paddingHorizontal: gutter }, hasRail && styles.railContent, contentStyle];

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
      <Backdrop tint={glowColor} />
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.scrollContent, ...inner]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          refreshControl={
            handleRefresh ? (
              <RefreshControl
                refreshing={pulled}
                onRefresh={handleRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
                progressBackgroundColor={colors.surfaceAlt}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.fill, ...inner]}>{body}</View>
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
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 150,
  },
  railContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge * 2,
  },
});
