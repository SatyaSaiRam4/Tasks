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
import { brand, colors, font, gradients, radius, RAIL_WIDTH, shadow, spacing, TAB_BAR_HEIGHT } from '../theme';
import { Icon, type IconName } from '../components/Icon';
import { Glow, Gradient, Sheen } from '../components/Gradient';
import { Wordmark } from '../components/Brand';
import { Avatar } from '../components/Controls';
import { useMotion } from '../hooks/useMotion';
import { RailContext, useLayout } from '../hooks/useLayout';

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

/** Navigation chrome: the floating bar on phones and tablets, the rail on desktop. */
function TabBar(props: BottomTabBarProps) {
  const { hasRail } = useLayout();
  return hasRail ? <NavRail {...props} /> : <FloatingTabBar {...props} />;
}

function pressTab({ state, navigation }: BottomTabBarProps, index: number) {
  const route = state.routes[index];
  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
  if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name);
}

/**
 * A floating obsidian glass bar. A satin champagne pill glides to the
 * active tab and its icon lifts slightly; on tablets the bar is centered at
 * a fixed width. It stays midnight in both themes, like a jewellery case.
 */
function FloatingTabBar(props: BottomTabBarProps) {
  const { state } = props;
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const { isTablet } = useLayout();
  const [barWidth, setBarWidth] = useState(0);
  const x = useRef(new Animated.Value(state.index)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: state.index, useNativeDriver: true, speed: reduced ? 1000 : 14, bounciness: reduced ? 0 : 5 }).start();
  }, [state.index, reduced, x]);
  const slot = barWidth ? (barWidth - spacing.sm * 2) / state.routes.length : 0;

  return (
    <View style={[styles.tabWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
      <View
        style={[styles.tabBar, shadow.float, isTablet && styles.tabBarTablet]}
        accessibilityRole="tablist"
        onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
      >
        <Gradient colors={gradients.hero} direction="vertical" borderRadius={radius.xl} style={StyleSheet.absoluteFill} />
        <Sheen color={gradients.heroSheen} inset="12%" />
        {slot ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.tabIndicator, { width: slot, transform: [{ translateX: Animated.multiply(x, slot) }] }]}
          >
            <View style={styles.tabIndicatorPill}>
              <Glow color={brand.champagne} size={84} intensity={0.28} style={styles.tabIndicatorGlow} />
            </View>
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
              onPress={() => pressTab(props, index)}
              style={styles.tabItem}
            >
              <Icon name={tab.icon} size={21} color={focused ? brand.champagneLight : colors.heroTextTertiary} strokeWidth={focused ? 1.9 : 1.6} />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The desktop navigation rail: brand, the five destinations, and the signed-in member. */
function NavRail(props: BottomTabBarProps) {
  const { state } = props;
  const user = useAppSelector(selectCurrentUser);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.rail, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]} accessibilityRole="tablist">
      <Gradient colors={gradients.hero} direction="vertical" style={StyleSheet.absoluteFill} />
      <View style={styles.railEdge} />
      <View style={styles.railBrand}>
        <Wordmark light />
      </View>
      <Text style={styles.railSection}>Navigate</Text>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = TABS[route.name as keyof MainTabParamList];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => pressTab(props, index)}
            style={({ pressed }) => [styles.railItem, focused && styles.railItemActive, pressed && !focused && styles.railItemPressed]}
          >
            {focused ? <View style={styles.railMarker} /> : null}
            <Icon name={tab.icon} size={19} color={focused ? brand.champagneLight : colors.heroTextSecondary} strokeWidth={focused ? 1.9 : 1.6} />
            <Text style={[styles.railLabel, focused && styles.railLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.flex} />
      {user ? (
        <Pressable
          onPress={() => pressTab(props, state.routes.findIndex(r => r.name === 'ProfileTab'))}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={styles.railMember}
        >
          <Avatar name={user.display_name} emoji={user.avatar} size={40} />
          <View style={styles.flex}>
            <Text style={styles.railName} numberOfLines={1}>
              {user.display_name}
            </Text>
            <Text style={styles.railMeta} numberOfLines={1}>
              {user.public_id}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

// --- Navigators ---------------------------------------------------------------------

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

function MainTabs() {
  const { isDesktop } = useLayout();
  return (
    <RailContext.Provider value={isDesktop}>
      <Tab.Navigator
        tabBar={renderTabBar}
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          sceneStyle: { backgroundColor: colors.background },
          tabBarPosition: isDesktop ? 'left' : 'bottom',
        }}
      >
        <Tab.Screen name="HomeTab" component={DashboardScreen} />
        <Tab.Screen name="RoutinesTab" component={RoutinesScreen} />
        <Tab.Screen name="RemindersTab" component={RemindersScreen} />
        <Tab.Screen name="VaultTab" component={VaultScreen} />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} />
      </Tab.Navigator>
    </RailContext.Provider>
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
  flex: {
    flex: 1,
  },
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
    borderRadius: radius.xl,
    backgroundColor: brand.midnight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
    paddingHorizontal: spacing.sm,
  },
  tabBarTablet: {
    alignSelf: 'center',
    width: 580,
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
    width: '86%',
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.heroGoldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroGoldLine,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabIndicatorGlow: {
    position: 'absolute',
    top: -30,
  },
  tabIndicatorLine: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: brand.champagne,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabLabel: {
    ...font.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.heroTextTertiary,
  },
  tabLabelActive: {
    ...font.bold,
    color: colors.heroText,
  },
  rail: {
    width: RAIL_WIDTH,
    paddingHorizontal: spacing.lg,
    backgroundColor: brand.midnight,
  },
  railEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.heroLine,
  },
  railBrand: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  railSection: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.heroTextTertiary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  railItemActive: {
    backgroundColor: colors.heroGoldSoft,
    borderColor: colors.heroGoldLine,
  },
  railItemPressed: {
    backgroundColor: colors.heroGlass,
  },
  railMarker: {
    position: 'absolute',
    left: -spacing.lg,
    top: 12,
    bottom: 12,
    width: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: brand.champagne,
  },
  railLabel: {
    ...font.semibold,
    fontSize: 14,
    color: colors.heroTextSecondary,
  },
  railLabelActive: {
    color: colors.heroText,
  },
  railMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.heroGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
  },
  railName: {
    ...font.semibold,
    fontSize: 14,
    color: colors.heroText,
  },
  railMeta: {
    ...font.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: brand.champagne,
    marginTop: 2,
  },
});
