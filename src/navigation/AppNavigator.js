import React from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Home, Users, DollarSign, Settings } from 'lucide-react-native';

import { useAppStore } from '../store/useAppStore';
import { useThemeColors } from '../theme/palette';

// Screens
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MembersScreen from '../screens/MembersScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddEditMemberScreen from '../screens/AddEditMemberScreen';
import MemberDetailScreen from '../screens/MemberDetailScreen';
import PlansScreen from '../screens/PlansScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import BackupRestoreScreen from '../screens/BackupRestoreScreen';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

function MainTabs() {
  const colors = useThemeColors();
  const isDark = colors.background === '#141A22';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Tab.Navigator
      tabBarPosition="bottom"
      swipeEnabled={true}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          const size = 24;
          if (route.name === 'Dashboard') return <Home color={color} size={size} />;
          if (route.name === 'Members') return <Users color={color} size={size} />;
          if (route.name === 'Payments') return <DollarSign color={color} size={size} />;
          if (route.name === 'Notifications') return <Bell color={color} size={size} />;
          if (route.name === 'Settings') return <Settings color={color} size={size} />;
        },
        tabBarShowIcon: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          borderRadius: 28,
          height: 68,
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarItemStyle: {
          paddingTop: 4,
          paddingBottom: 4,
          minHeight: 68,
        },
        tabBarIndicatorStyle: { backgroundColor: 'transparent' },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 12, textTransform: 'none', marginTop: 2 },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Members" component={MembersScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
    </SafeAreaView>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const themeMode = useAppStore((state) => state.themeMode);
  const colors = useThemeColors();
  const baseTheme = themeMode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen 
              name="AddEditMember" 
              component={AddEditMemberScreen} 
              options={{ headerShown: true, title: 'Manage Member' }}
            />
            <Stack.Screen 
              name="MemberDetail" 
              component={MemberDetailScreen} 
              options={{ headerShown: true, title: 'Member Profile' }}
            />
            <Stack.Screen 
              name="Plans" 
              component={PlansScreen} 
              options={{ headerShown: true, title: 'Plans & Pricing' }}
            />
            <Stack.Screen 
              name="Notifications" 
              component={NotificationsScreen} 
              options={{ headerShown: true, title: 'Notifications' }}
            />
            <Stack.Screen 
              name="BackupRestore" 
              component={BackupRestoreScreen} 
              options={{ headerShown: true, title: 'Backup & Restore' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
