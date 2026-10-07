/**
 * The single source of truth for Memo's navigation.
 *
 * Per the project convention, every navigator, the bottom tab bar, and the
 * NavigationContainer live in this one file so the whole app's flow reads
 * top to bottom:
 *
 *   Signed out → Login / Register / ForgotPassword / ResetPassword
 *   Signed in → Main tabs (Home · Categories · Reminders · Vault · Profile)
 *               + stack screens pushed on top of the tabs.
 *   First time (or "Replay tour") → Satya's tour, drawn over the real app.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type NavigatorScreenParams,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated, selectCurrentUser } from '../modules/auth/authSlice';
import { colors, font, radius, shadow, spacing, TAB_BAR_HEIGHT } from '../theme';
import { Icon, type IconName } from '../components/Icon';
import { Gradient } from '../components/Gradient';
import { useMotion } from '../hooks/useMotion';
import { useLayout } from '../hooks/useLayout';
import { easeOut } from '../animations';

import { LoginScreen } from '../modules/auth/screens/LoginScreen';
import { RegisterScreen } from '../modules/auth/screens/RegisterScreen';
import { ForgotPasswordScreen } from '../modules/auth/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../modules/auth/screens/ResetPasswordScreen';
import { SatyaTour } from '../modules/onboarding/SatyaTour';
import { DashboardScreen } from '../modules/home/screens/DashboardScreen';
import { RoutinesScreen } from '../modules/routines/screens/RoutinesScreen';
import { TrackDetailScreen } from '../modules/routines/screens/TrackDetailScreen';
import { TrackEditorScreen } from '../modules/routines/screens/TrackEditorScreen';
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
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  TrackDetail: { trackId: string };
  TrackEditor: { trackId?: string } | undefined;
  Consistency: undefined;
  Achievements: undefined;
  ReminderEditor: { reminderId?: string; date?: string } | undefined;
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
  RoutinesTab: { label: 'Categories', icon: 'target' },
  RemindersTab: { label: 'Reminders', icon: 'bell' },
  VaultTab: { label: 'Vault', icon: 'lock' },
  ProfileTab: { label: 'Profile', icon: 'user' },
};

/**
 * A floating glass tab bar. A champagne pill glides to the active tab;
 * the active icon turns gold. On tablets the bar is centered at a fixed width.
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const { isTablet } = useLayout();
  const [barWidth, setBarWidth] = useState(0);
  const x = useRef(new Animated.Value(state.index)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: state.index, duration: reduced ? 0 : 420, easing: easeOut, useNativeDriver: true }).start();
  }, [state.index, reduced, x]);
  const slot = barWidth ? (barWidth - spacing.sm * 2) / state.routes.length : 0;

  return (
    <View style={[styles.tabWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
      <View
        style={[styles.tabBar, shadow.float, isTablet && styles.tabBarTablet]}
        accessibilityRole="tablist"
        onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
      >
        <Gradient colors={['#151C34', '#090C17']} direction="vertical" borderRadius={radius.xl + 4} style={StyleSheet.absoluteFill} />
        <View style={styles.tabSheen} pointerEvents="none" />
        {slot ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.tabIndicator, { width: slot, transform: [{ translateX: Animated.multiply(x, slot) }] }]}
          >
            <View style={styles.tabIndicatorPill} />
            <View style={styles.tabIndicatorLine} />
          </Animated.View>
        ) : null}
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
              <Icon name={tab.icon} size={21} color={focused ? colors.gold : colors.textTertiary} strokeWidth={focused ? 2 : 1.7} />
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
    <Tab.Navigator tabBar={renderTabBar} screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: colors.background } }}>
      <Tab.Screen name="HomeTab" component={DashboardScreen} />
      <Tab.Screen name="RoutinesTab" component={RoutinesScreen} />
      <Tab.Screen name="RemindersTab" component={RemindersScreen} />
      <Tab.Screen name="VaultTab" component={VaultScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const navTheme: Theme = {
  ...(colors.isDark ? DarkTheme : DefaultTheme),
  colors: {
    ...(colors.isDark ? DarkTheme.colors : DefaultTheme.colors),
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function RootNavigator() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const showTour = isAuthenticated && user && !user.onboarding_completed;

  const goToTab = useCallback((tab: keyof MainTabParamList) => {
    if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: tab });
  }, []);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: colors.background } }}
      >
        {!isAuthenticated ? (
          <RootStack.Group screenOptions={{ animation: 'fade' }}>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </RootStack.Group>
        ) : (
          <RootStack.Group>
            <RootStack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
            <RootStack.Screen name="TrackDetail" component={TrackDetailScreen} />
            <RootStack.Screen name="TrackEditor" component={TrackEditorScreen} options={{ animation: 'slide_from_bottom' }} />
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
      {showTour ? <SatyaTour goToTab={goToTab} /> : null}
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
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.xl + 4,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    paddingHorizontal: spacing.sm,
  },
  tabBarTablet: {
    alignSelf: 'center',
    width: 560,
  },
  tabSheen: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 1,
    backgroundColor: 'rgba(241,221,175,0.35)',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicatorPill: {
    width: '84%',
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,188,130,0.25)',
  },
  tabIndicatorLine: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.gold,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    ...font.semibold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.text,
  },
});
