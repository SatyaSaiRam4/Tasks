/**
 * The single source of truth for Rememberly's navigation.
 *
 * Per the project convention, every navigator, the bottom tab bar, and the
 * NavigationContainer live in this one file so the whole app's flow reads
 * top to bottom:
 *
 *   Signed out → Login / Register / ForgotPassword / ResetPassword
 *   Signed in, first time → Onboarding (Satya's tour) → Main
 *   Signed in → Main tabs (Home · Routines · Reminders · Vault · Profile)
 *               + stack screens pushed on top of the tabs.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated, selectCurrentUser } from '../modules/auth/authSlice';
import { colors, radius, shadow, spacing } from '../theme';
import { Icon, type IconName } from '../components/Icon';

import { LoginScreen } from '../modules/auth/screens/LoginScreen';
import { RegisterScreen } from '../modules/auth/screens/RegisterScreen';
import { ForgotPasswordScreen } from '../modules/auth/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../modules/auth/screens/ResetPasswordScreen';
import { OnboardingScreen } from '../modules/onboarding/OnboardingScreen';
import { DashboardScreen } from '../modules/home/screens/DashboardScreen';
import { RoutinesScreen } from '../modules/routines/screens/RoutinesScreen';
import { TrackDetailScreen } from '../modules/routines/screens/TrackDetailScreen';
import { TrackEditorScreen } from '../modules/routines/screens/TrackEditorScreen';
import { ActionEditorScreen } from '../modules/routines/screens/ActionEditorScreen';
import { ConsistencyScreen } from '../modules/streaks/screens/ConsistencyScreen';
import { AchievementsScreen } from '../modules/streaks/screens/AchievementsScreen';
import { RemindersScreen } from '../modules/reminders/screens/RemindersScreen';
import { ReminderEditorScreen } from '../modules/reminders/screens/ReminderEditorScreen';
import { VaultScreen } from '../modules/vault/screens/VaultScreen';
import { VaultEntryScreen } from '../modules/vault/screens/VaultEntryScreen';
import { ProfileScreen } from '../modules/profile/screens/ProfileScreen';
import { DiscoverScreen } from '../modules/discover/screens/DiscoverScreen';
import { SettingsScreen } from '../modules/settings/screens/SettingsScreen';
import { ChangePasswordScreen } from '../modules/settings/screens/ChangePasswordScreen';
import { AdminDashboardScreen } from '../modules/admin/screens/AdminDashboardScreen';
import { AdminUsersScreen } from '../modules/admin/screens/AdminUsersScreen';

// --- Param lists ----------------------------------------------------------------

export type MainTabParamList = {
  HomeTab: undefined;
  RoutinesTab: undefined;
  RemindersTab: undefined;
  VaultTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string } | undefined;
  Onboarding: undefined;
  Main: undefined;
  TrackDetail: { trackId: string };
  TrackEditor: { trackId?: string } | undefined;
  ActionEditor: { trackId: string; actionId?: string };
  Consistency: undefined;
  Achievements: undefined;
  ReminderEditor: { reminderId?: string } | undefined;
  VaultEntry: { entryId?: string; folder?: string } | undefined;
  Discover: undefined;
  Settings: undefined;
  ChangePassword: undefined;
  AdminDashboard: undefined;
  AdminUsers: undefined;
};

// --- Tab bar ----------------------------------------------------------------------

const TABS: Record<keyof MainTabParamList, { label: string; icon: IconName }> = {
  HomeTab: { label: 'Home', icon: 'home' },
  RoutinesTab: { label: 'Routines', icon: 'target' },
  RemindersTab: { label: 'Reminders', icon: 'bell' },
  VaultTab: { label: 'Vault', icon: 'lock' },
  ProfileTab: { label: 'Profile', icon: 'user' },
};

/** A floating, rounded tab bar with an accent pill behind the active tab. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
      <View style={[styles.tabBar, shadow.float]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS[route.name as keyof MainTabParamList];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tabItem}
            >
              <View style={[styles.tabPill, focused && styles.tabPillActive]}>
                <Icon name={tab.icon} size={21} color={focused ? colors.primary : colors.textTertiary} strokeWidth={focused ? 2.3 : 2} />
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// --- Navigators ---------------------------------------------------------------------

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

function MainTabs() {
  return (
    <Tab.Navigator tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={DashboardScreen} />
      <Tab.Screen name="RoutinesTab" component={RoutinesScreen} />
      <Tab.Screen name="RemindersTab" component={RemindersScreen} />
      <Tab.Screen name="VaultTab" component={VaultScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

export function RootNavigator() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const needsOnboarding = isAuthenticated && user && !user.onboarding_completed;

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}
      >
        {!isAuthenticated ? (
          <RootStack.Group screenOptions={{ animation: 'fade' }}>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </RootStack.Group>
        ) : needsOnboarding ? (
          // The tour exists only in this branch (first run, or "Replay tour" in
          // Settings, which resets the flag). Keep it out of the signed-in
          // group: a same-named route there would be kept on completion and
          // the user would stay stuck on the tour.
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        ) : (
          <RootStack.Group>
            <RootStack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
            <RootStack.Screen name="TrackDetail" component={TrackDetailScreen} />
            <RootStack.Screen name="TrackEditor" component={TrackEditorScreen} options={{ animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="ActionEditor" component={ActionEditorScreen} options={{ animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="Consistency" component={ConsistencyScreen} />
            <RootStack.Screen name="Achievements" component={AchievementsScreen} />
            <RootStack.Screen name="ReminderEditor" component={ReminderEditorScreen} options={{ animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="VaultEntry" component={VaultEntryScreen} options={{ animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="Discover" component={DiscoverScreen} />
            <RootStack.Screen name="Settings" component={SettingsScreen} />
            <RootStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <RootStack.Screen name="AdminUsers" component={AdminUsersScreen} />
          </RootStack.Group>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    minHeight: 48,
  },
  tabPill: {
    width: 48,
    height: 30,
    // Always carry a (transparent) fill and clip: on Android, a radius set
    // before any background exists is not applied when the fill appears.
    borderRadius: 15,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.text,
  },
});
