import React from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, GUTTER, radius, spacing, type as t } from '../../../theme';
import { Glow } from '../../../components/Gradient';
import { FadeIn } from '../../../components/Feedback';
import { MoonMark } from '../../../components/Brand';
import { Eyebrow, ScreenHeader } from '../../../components/ScreenHeader';
import { Backdrop } from '../../../layouts/Backdrop';
import { useLayout } from '../../../hooks/useLayout';
import { useLoop } from '../../../animations';

/**
 * Shared shell for the signed-out screens: a moonrise over the night sky,
 * the Memo name, a serif title, and the form on a glass panel.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  back,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  back?: boolean;
}) {
  const { isTablet } = useLayout();
  const float = useLoop(7000);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });
  const glow = float.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {back ? <ScreenHeader /> : null}
          <FadeIn style={[styles.brand, back && styles.brandCompact]}>
            <Animated.View style={[styles.moon, { transform: [{ translateY }] }]}>
              <Animated.View style={[styles.moonGlow, { opacity: glow }]}>
                <Glow color={colors.gold} size={240} intensity={0.3} />
              </Animated.View>
              <MoonMark size={back ? 64 : 92} />
            </Animated.View>
            <Text style={styles.wordmark}>Memo</Text>
          </FadeIn>
          <FadeIn index={1}>
            <Eyebrow label="Your days, beautifully kept" />
            <Text style={[t.display, styles.title]}>{title}</Text>
            <Text style={[t.body, styles.subtitle]}>{subtitle}</Text>
          </FadeIn>
          <FadeIn index={2} style={styles.form}>
            <View style={styles.sheen} pointerEvents="none" />
            {children}
          </FadeIn>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.xxl,
  },
  contentTablet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxl,
  },
  brandCompact: {
    marginTop: 0,
  },
  moon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 140,
  },
  moonGlow: {
    position: 'absolute',
  },
  wordmark: {
    ...t.display,
    fontSize: 36,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  form: {
    padding: spacing.xl,
    paddingBottom: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(241,221,175,0.4)',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
});
