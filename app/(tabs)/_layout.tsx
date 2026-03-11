import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Platform, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const { user } = useAuth();
  const { membershipRole } = useOrg();
  const { t } = useTranslation();
  const router = useRouter();

  if (!user) return null;

  // Org-aware admin check: org owner/admin OR global super admin
  const isOrgAdmin = membershipRole === 'admin' || membershipRole === 'owner';
  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin';
  const isAdmin = isOrgAdmin || isSuperAdmin;

  // Show teacher tabs if not an org admin OR if a super admin
  const showTeacherTabs = !isOrgAdmin || isSuperAdmin;

  const settingsButton = (
    <TouchableOpacity
      onPress={() => router.push('/settings' as any)}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
    >
      <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
    </TouchableOpacity>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'left',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerBackground: () => (
          <LinearGradient
            colors={colors.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        ),
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: fonts.bold,
          color: colors.textPrimary,
          fontSize: 18,
          // In RTL, if headerTitleAlign is 'left', it is physically left.
          // To get it to the right, we either use 'right' (invalid) or center it with text align.
          // Actually, 'left' on Android is 'Start'. On Web/iOS it might be literal left.
          textAlign: I18nManager.isRTL ? 'right' : 'left',
        },
        headerRightContainerStyle: {
          paddingHorizontal: I18nManager.isRTL ? 0 : 16,
        },
        headerLeftContainerStyle: {
          paddingHorizontal: I18nManager.isRTL ? 16 : 0,
        },
        headerLeft: () => I18nManager.isRTL ? settingsButton : null,
        headerRight: () => !I18nManager.isRTL ? settingsButton : null,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSubtle,
          height: Platform.OS === 'web' ? 65 : 60,
          paddingBottom: Platform.OS === 'web' ? 12 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.accentSecondary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: fonts.regular,
          fontSize: 10,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: showTeacherTabs ? '/' : null,
          title: t('tabs.dashboard'),
          headerTitle: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="schools"
        options={{
          href: showTeacherTabs ? '/schools' : null,
          title: t('tabs.schools'),
          headerTitle: t('tabs.schools'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          href: isAdmin ? '/admin' : null,
          title: t('tabs.admin'),
          headerTitle: t('tabs.admin'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="announcements"
        options={{
          title: t('tabs.announcements'),
          headerTitle: t('tabs.announcements'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="school-history"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
