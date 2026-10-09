/**
 * The single source of truth for Memo's navigation.
 *
 * Per the project convention, every navigator, the bottom tab bar, and the
 * NavigationContainer live in this one file so the whole app's flow reads
 * top to bottom:
 *
 *   Signed out → Login / Register / ForgotPassword / ResetPassword
 *   Signed in → Main tabs (Home · Plans · Reminders · Vault · Profile)
 *               + stack screens pushed on top of the tabs. The tab bar (or
 *               the desktop rail) is drawn over every signed-in screen, so
 *               the five destinations are always one tap away.
 *   First sign-in → the welcome story (once per account on this device),
 *   then Satya's tour drawn over the real app. Both replay from Settings.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  StackActions,
  type NavigatorScreenParams,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { storyClosed, storyOpened } from '../app/preferencesSlice';
import { selectIsAuthenticated, selectCurrentUser } from '../modules/auth/authSlice';
import { brand, colors, font, gradients, radius, RAIL_WIDTH, shadow, spacing, TAB_BAR_HEIGHT } from '../theme';
import { RealIcon, type RealIconName } from '../components/RealIcon';
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
import { WelcomeStory } from '../modules/onboarding/WelcomeStory';
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
import { WalletScreen } from '../modules/wallet/screens/WalletScreen';

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
  Wallet: undefined;
};

// --- Tab bar ----------------------------------------------------------------------

const TABS: Record<keyof MainTabParamList, { label: string; icon: RealIconName }> = {
  HomeTab: { label: 'Home', icon: 'home' },
  RoutinesTab: { label: 'Plans', icon: 'target' },
  RemindersTab: { label: 'Reminders', icon: 'bell' },
  VaultTab: { label: 'Vault', icon: 'lock' },
  ProfileTab: { label: 'Profile', icon: 'user' },
};

type TabKey = keyof MainTabParamList;
const TAB_ORDER = Object.keys(TABS) as TabKey[];

interface ChromeProps {
  active: TabKey;
  onPress: (tab: TabKey) => void;
}

/**
 * A floating obsidian glass bar. A satin champagne pill glides to the
 * active tab and its icon lifts slightly; on tablets the bar is centered at
 * a fixed width. It stays midnight in both themes, like a jewellery case.
 */
function FloatingTabBar({ active, onPress }: ChromeProps) {
  const index = TAB_ORDER.indexOf(active);
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const { isTablet } = useLayout();
  const [barWidth, setBarWidth] = useState(0);
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: reduced ? 1000 : 14, bounciness: reduced ? 0 : 5 }).start();
  }, [index, reduced, x]);
  const slot = barWidth ? (barWidth - spacing.sm * 2) / TAB_ORDER.length : 0;

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
        {TAB_ORDER.map(name => {
          const focused = name === active;
          const tab = TABS[name];
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => onPress(name)}
              style={styles.tabItem}
            >
              <View style={!focused && styles.tabIconIdle}>
                <RealIcon name={tab.icon} size={focused ? 26 : 23} />
              </View>
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
function NavRail({ active, onPress }: ChromeProps) {
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
      {TAB_ORDER.map(name => {
        const focused = name === active;
        const tab = TABS[name];
        return (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => onPress(name)}
            style={({ pressed }) => [styles.railItem, focused && styles.railItemActive, pressed && !focused && styles.railItemPressed]}
          >
            {focused ? <View style={styles.railMarker} /> : null}
            <View style={!focused && styles.tabIconIdle}>
              <RealIcon name={tab.icon} size={22} />
            </View>
            <Text style={[styles.railLabel, focused && styles.railLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.flex} />
      {user ? (
        <Pressable
          onPress={() => onPress('ProfileTab')}
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

const hideTabBar = () => null;

/**
 * Tabs slide in from the side they sit on: moving to a tab on the right
 * brings it in from the right, and the old one leaves to the left.
 */
type SceneInterpolator = NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']>;

function slideScenes(width: number): SceneInterpolator {
  return ({ current }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, -0.6, 0, 0.6, 1], outputRange: [0, 0, 1, 0, 0] }),
      transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-width * 0.3, 0, width * 0.3] }) }],
    },
  });
}

function MainTabs() {
  const { width } = useWindowDimensions();
  const { reduced } = useMotion();
  return (
    <Tab.Navigator
      tabBar={hideTabBar}
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'none' : 'shift',
        sceneStyleInterpolator: reduced ? undefined : slideScenes(width),
        transitionSpec: { animation: 'timing', config: { duration: 280 } },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="HomeTab" component={DashboardScreen} />
      <Tab.Screen name="RoutinesTab" component={RoutinesScreen} />
      <Tab.Screen name="RemindersTab" component={RemindersScreen} />
      <Tab.Screen name="VaultTab" component={VaultScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** The tab under the current screen: the open tab, or the one a pushed screen sits on. */
function activeTab(): TabKey {
  const root = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
  const main = root?.routes.find(r => r.name === 'Main');
  const tabs = main?.state;
  const name = tabs?.routes[tabs.index ?? 0]?.name;
  return name && name in TABS ? (name as TabKey) : 'HomeTab';
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
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
const storySeenKey = (userId: string) => `@memo/story_seen_${userId}`;

export function RootNavigator() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const storyOpen = useAppSelector(s => s.preferences.storyOpen);
  const isNewUser = Boolean(isAuthenticated && user && !user.onboarding_completed);
  const showTour = isNewUser && !storyOpen;

  // A new user sees the story first, once; the tour follows when it closes.
  useEffect(() => {
    if (!isNewUser || !user) return;
    AsyncStorage.getItem(storySeenKey(user.id))
      .then(seen => {
        if (!seen) dispatch(storyOpened());
      })
      .catch(() => undefined);
  }, [isNewUser, user, dispatch]);

  const closeStory = useCallback(() => {
    if (user) AsyncStorage.setItem(storySeenKey(user.id), '1').catch(() => undefined);
    dispatch(storyClosed());
  }, [user, dispatch]);
  const { isDesktop } = useLayout();
  const keyboardOpen = useKeyboardOpen();
  const [active, setActive] = useState<TabKey>('HomeTab');
  const hasRail = Boolean(isAuthenticated && isDesktop);

  // Back to the tabs (popping any pushed screens), then to the chosen tab.
  const goToTab = useCallback((tab: TabKey) => {
    if (navigationRef.isReady()) navigationRef.dispatch(StackActions.popTo('Main', { screen: tab }));
  }, []);

  const navigator = (
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
          <RootStack.Screen name="TrackDetail" component={TrackDetailScreen} options={{ animation: 'slide_from_right' }} />
          <RootStack.Screen name="TrackEditor" component={TrackEditorScreen} options={{ animation: 'slide_from_bottom' }} />
          <RootStack.Screen name="Consistency" component={ConsistencyScreen} options={{ animation: 'slide_from_left' }} />
          <RootStack.Screen name="Achievements" component={AchievementsScreen} options={{ animation: 'slide_from_right' }} />
          <RootStack.Screen name="ReminderEditor" component={ReminderEditorScreen} options={{ animation: 'slide_from_bottom' }} />
          <RootStack.Screen name="VaultEntry" component={VaultEntryScreen} options={{ animation: 'slide_from_bottom' }} />
          <RootStack.Screen name="Discover" component={DiscoverScreen} options={{ animation: 'slide_from_right' }} />
          <RootStack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
          <RootStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ animation: 'slide_from_bottom' }} />
          <RootStack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ animation: 'slide_from_right' }} />
          <RootStack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ animation: 'slide_from_right' }} />
          <RootStack.Screen name="Wallet" component={WalletScreen} options={{ animation: 'slide_from_right' }} />
        </RootStack.Group>
      )}
    </RootStack.Navigator>
  );

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={() => setActive(activeTab())} onStateChange={() => setActive(activeTab())}>
      <RailContext.Provider value={hasRail}>
        {hasRail ? (
          <View style={styles.railLayout}>
            <NavRail active={active} onPress={goToTab} />
            <View style={styles.flex}>{navigator}</View>
          </View>
        ) : (
          <>
            {navigator}
            {isAuthenticated && !keyboardOpen ? <FloatingTabBar active={active} onPress={goToTab} /> : null}
          </>
        )}
      </RailContext.Provider>
      {showTour ? <SatyaTour goToTab={goToTab} /> : null}
      {isAuthenticated && storyOpen ? <WelcomeStory onDone={closeStory} /> : null}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  railLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
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
    gap: 3,
  },
  tabIconIdle: {
    opacity: 0.6,
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
