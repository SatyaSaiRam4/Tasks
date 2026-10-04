/**
 * The single source of truth for Rememberly's navigation structure.
 *
 * Per the project's navigation convention, every stack navigator, the bottom
 * tab navigator, and the NavigationContainer all live in this one file so the
 * whole app's navigation graph is readable top to bottom.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAppSelector } from '../app/hooks';
import { selectIsAdmin, selectIsAuthenticated } from '../modules/auth/authSlice';
import { border, colors, fontSize } from '../theme';

import { LoginScreen } from '../modules/auth/screens/LoginScreen';
import { RegisterScreen } from '../modules/auth/screens/RegisterScreen';
import { HomeScreen } from '../modules/home/screens/HomeScreen';
import { CategoriesScreen } from '../modules/categories/screens/CategoriesScreen';
import { CategoryDetailScreen } from '../modules/categories/screens/CategoryDetailScreen';
import { TaskDetailScreen } from '../modules/tasks/screens/TaskDetailScreen';
import { CreateEditTaskScreen } from '../modules/tasks/screens/CreateEditTaskScreen';
import { NotesScreen } from '../modules/notes/screens/NotesScreen';
import { NoteEditorScreen } from '../modules/notes/screens/NoteEditorScreen';
import { RemindersScreen } from '../modules/reminders/screens/RemindersScreen';
import { CreateEditReminderScreen } from '../modules/reminders/screens/CreateEditReminderScreen';
import { AdminDashboardScreen } from '../modules/admin/screens/AdminDashboardScreen';
import { AdminUsersScreen } from '../modules/admin/screens/AdminUsersScreen';
import { SettingsScreen } from '../modules/settings/screens/SettingsScreen';

// --- Param lists -------------------------------------------------------

export type MainTabParamList = {
  HomeTab: undefined;
  CategoriesTab: undefined;
  RemindersTab: undefined;
  NotesTab: undefined;
  AdminTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  CategoryDetail: { categoryId: string; categoryName?: string };
  TaskDetail: { taskId: string };
  CreateEditTask: { taskId?: string; categoryId?: string; date?: string } | undefined;
  NoteEditor: { noteId?: string; categoryId?: string; taskId?: string } | undefined;
  CreateEditReminder: { reminderId?: string } | undefined;
  AdminUsers: undefined;
};

// --- Simple text-glyph tab icon (keeps the tab bar dependency-free) ----

function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={[tabStyles.glyph, focused && tabStyles.glyphFocused]} accessibilityElementsHidden>
      {glyph}
    </Text>
  );
}

const tabStyles = StyleSheet.create({
  glyph: {
    fontSize: 20,
    color: colors.textFaint,
  },
  glyphFocused: {
    color: colors.primary,
  },
});

const TAB_BAR_HEIGHT = 62;

// --- Navigators ----------------------------------------------------------

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const isAdmin = useAppSelector(selectIsAdmin);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopWidth: border.thick,
          borderTopColor: colors.primary,
          height: TAB_BAR_HEIGHT,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="⌂" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CategoriesTab"
        component={CategoriesScreen}
        options={{
          title: 'Categories',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="▤" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="RemindersTab"
        component={RemindersScreen}
        options={{
          title: 'Reminders',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="◷" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="NotesTab"
        component={NotesScreen}
        options={{
          title: 'Notes',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="✎" focused={focused} />,
        }}
      />
      {isAdmin ? (
        <Tab.Screen
          name="AdminTab"
          component={AdminDashboardScreen}
          options={{
            title: 'Admin',
            tabBarIcon: ({ focused }) => <TabGlyph glyph="⚑" focused={focused} />,
          }}
        />
      ) : null}
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="⚙" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const detailScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, color: colors.ink },
  headerBackTitle: '',
  headerShadowVisible: true,
  contentStyle: { backgroundColor: colors.background },
};

export function RootNavigator() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Group>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen
              name="CategoryDetail"
              component={CategoryDetailScreen}
              options={{ ...detailScreenOptions, title: 'Category' }}
            />
            <RootStack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{ ...detailScreenOptions, title: 'Task' }}
            />
            <RootStack.Screen
              name="CreateEditTask"
              component={CreateEditTaskScreen}
              options={{ ...detailScreenOptions, title: 'Task', presentation: 'modal' }}
            />
            <RootStack.Screen
              name="NoteEditor"
              component={NoteEditorScreen}
              options={{ ...detailScreenOptions, title: 'Note', presentation: 'modal' }}
            />
            <RootStack.Screen
              name="CreateEditReminder"
              component={CreateEditReminderScreen}
              options={{ ...detailScreenOptions, title: 'Reminder', presentation: 'modal' }}
            />
            <RootStack.Screen
              name="AdminUsers"
              component={AdminUsersScreen}
              options={{ ...detailScreenOptions, title: 'Users' }}
            />
          </RootStack.Group>
        ) : (
          <RootStack.Group>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
          </RootStack.Group>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
