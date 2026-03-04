import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
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

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
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
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.push('/settings' as any)}
            style={{ marginRight: 15, padding: 5 }}
          >
            <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSubtle,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.accentSecondary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: fonts.regular,
          fontSize: 11,
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
        name="school-history"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
