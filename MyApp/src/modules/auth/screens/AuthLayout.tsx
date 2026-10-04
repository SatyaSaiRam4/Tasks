import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, GUTTER, radius, spacing, type as t } from '../../../theme';
import { Glow, Gradient } from '../../../components/Gradient';
import { FadeIn } from '../../../components/Feedback';
import { gradients } from '../../../theme';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';

/** Shared shell for the signed-out screens: brand mark, title, and form. */
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
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Glow color={colors.primary} size={560} intensity={0.22} style={styles.glow} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {back ? <ScreenHeader /> : null}
          <FadeIn>
            <View style={styles.brand}>
              <Gradient colors={gradients.primary} borderRadius={radius.lg} style={styles.mark}>
                <Icon name="flame" size={26} color={colors.white} strokeWidth={2.2} />
              </Gradient>
              <Text style={styles.wordmark}>Memo</Text>
            </View>
            <Text style={[t.display, styles.title]}>{title}</Text>
            <Text style={[t.body, styles.subtitle]}>{subtitle}</Text>
          </FadeIn>
          <FadeIn index={2} style={styles.form}>
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
  glow: {
    position: 'absolute',
    top: -280,
    alignSelf: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.xxl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxl,
  },
  mark: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  form: {
    gap: 0,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
});
