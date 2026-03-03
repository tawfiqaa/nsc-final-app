import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/contexts/AuthContext';
import { useOrg } from '../../src/contexts/OrgContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const { user } = useAuth();
  const { membershipRole } = useOrg();
  const { t } = useTranslation();

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
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="school-history"
        options={{
          href: showTeacherTabs ? '/school-history' : null,
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          href: isAdmin ? '/(tabs)/admin' : null,
          title: t('tabs.admin'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
