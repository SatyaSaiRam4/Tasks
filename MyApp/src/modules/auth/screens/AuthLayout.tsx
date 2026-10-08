import React from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brand, colors, gradients, GUTTER, radius, spacing, type as t } from '../../../theme';
import { Glow, Gradient, Sheen } from '../../../components/Gradient';
import { FadeIn } from '../../../components/Feedback';
import { Wordmark } from '../../../components/Brand';
import { Eyebrow, ScreenHeader } from '../../../components/ScreenHeader';
import { Backdrop } from '../../../layouts/Backdrop';
import { useLayout } from '../../../hooks/useLayout';
import { useLoop } from '../../../animations';

/**
 * Shared shell for the signed-out screens: the Memo monogram in a soft
 * halo, a serif title, and the form on a raised pane. On desktop the brand
 * gets its own cinematic panel beside the form.
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
  const { isTablet, isDesktop } = useLayout();
  const float = useLoop(7000);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });
  const glow = float.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  const form = (
    <ScrollView
      contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {back ? <ScreenHeader /> : null}
      {isDesktop ? null : (
        <FadeIn style={[styles.brand, back && styles.brandCompact]}>
          <Animated.View style={[styles.mark, { transform: [{ translateY }] }]}>
            <Animated.View style={[styles.markGlow, { opacity: glow }]}>
              <Glow color={colors.gold} size={260} intensity={colors.isDark ? 0.26 : 0.2} />
            </Animated.View>
            <Wordmark size="lg" />
          </Animated.View>
        </FadeIn>
      )}
      <FadeIn index={1} style={isDesktop && styles.desktopTitle}>
        <Eyebrow label="Your days, beautifully kept" />
        <Text style={[t.display, styles.title]}>{title}</Text>
        <Text style={[t.body, styles.subtitle]}>{subtitle}</Text>
      </FadeIn>
      <FadeIn index={2} style={styles.form}>
        <Sheen inset="20%" />
        {children}
      </FadeIn>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Backdrop />
      <KeyboardAvoidingView style={[styles.flex, isDesktop && styles.split]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isDesktop ? (
          <View style={styles.panel}>
            <Gradient colors={gradients.hero} direction="diagonal" style={StyleSheet.absoluteFill} />
            <Glow color={brand.champagne} size={640} intensity={0.16} style={styles.panelGlow} />
            <Glow color={brand.azure} size={560} intensity={0.12} style={styles.panelGlowB} />
            <Animated.View style={{ transform: [{ translateY }] }}>
              <Wordmark size="lg" light />
            </Animated.View>
            <Text style={styles.panelQuote}>Small promises, kept daily, become the life you meant to live.</Text>
            <View style={styles.panelRule} />
            <Text style={styles.panelCaption}>Categories · Streaks · Reminders · Private Vault</Text>
          </View>
        ) : null}
        <View style={styles.flex}>{form}</View>
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
  split: {
    flexDirection: 'row',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.xxl,
  },
  contentTablet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginTop: spacing.huge,
    marginBottom: spacing.xxxl,
  },
  brandCompact: {
    marginTop: 0,
    marginBottom: spacing.xxl,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 150,
  },
  markGlow: {
    position: 'absolute',
  },
  desktopTitle: {
    marginTop: spacing.huge * 1.5,
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  panel: {
    flex: 1,
    maxWidth: 620,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.huge,
    overflow: 'hidden',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.heroLine,
  },
  panelGlow: {
    position: 'absolute',
    top: -200,
    right: -200,
  },
  panelGlowB: {
    position: 'absolute',
    bottom: -220,
    left: -200,
  },
  panelQuote: {
    ...t.aside,
    fontSize: 26,
    lineHeight: 34,
    color: colors.heroText,
    textAlign: 'center',
    maxWidth: 420,
    marginTop: spacing.huge,
  },
  panelRule: {
    width: 48,
    height: 1,
    backgroundColor: colors.heroLine,
    marginVertical: spacing.xxl,
  },
  panelCaption: {
    ...t.micro,
    color: brand.champagne,
  },
});
