import { NotoSans_400Regular, NotoSans_500Medium, NotoSans_700Bold } from '@expo-google-fonts/noto-sans';
import { NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_700Bold } from '@expo-google-fonts/noto-sans-arabic';
import { NotoSansHebrew_400Regular, NotoSansHebrew_500Medium, NotoSansHebrew_700Bold } from '@expo-google-fonts/noto-sans-hebrew';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { LessonProvider } from '../src/contexts/LessonContext';
import { OrgProvider, useOrg } from '../src/contexts/OrgContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { initPromise } from '../src/i18n/i18n'; // Initialize i18n

SplashScreen.preventAutoHideAsync();

const ORG_FREE_ROUTES = ['org-onboarding', 'create-org', 'join-org', 'org-pending'];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (segments[0] !== 'login') {
        router.replace('/login');
      }
    } else {
      if (!user.isApproved) {
        if (segments[0] !== 'awaiting-approval') {
          router.replace('/awaiting-approval');
        }
      } else {
        if (segments[0] === 'login' || segments[0] === 'awaiting-approval') {
          router.replace('/(tabs)');
        }
      }
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function OrgGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeOrgId, membershipStatus, orgLoading } = useOrg();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (orgLoading) return;
    if (!user || !user.isApproved) return; // AuthGuard handles these

    const currentRoute = segments[0] as string;

    // Skip org checks for auth-related routes
    if (currentRoute === 'login' || currentRoute === 'awaiting-approval') return;

    // Super admin can bypass org requirement for now
    if (user.isSuperAdmin) return;

    if (!activeOrgId) {
      // No active org → onboarding
      if (!ORG_FREE_ROUTES.includes(currentRoute)) {
        router.replace('/org-onboarding' as any);
      }
    } else if (membershipStatus === 'pending' || membershipStatus === 'rejected' || membershipStatus === null) {
      // Org set but not approved
      if (!ORG_FREE_ROUTES.includes(currentRoute)) {
        router.replace('/org-pending' as any);
      }
    } else if (membershipStatus === 'approved') {
      // Approved → redirect away from org screens
      if (ORG_FREE_ROUTES.includes(currentRoute)) {
        router.replace('/(tabs)');
      }
    }
  }, [activeOrgId, membershipStatus, orgLoading, user, segments, router]);

  if (orgLoading && user?.isApproved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      contentStyle: { backgroundColor: colors.background },
      headerBackTitle: '',
      headerTitle: ''
    }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="awaiting-approval" options={{ headerShown: false }} />
      <Stack.Screen name="org-onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="create-org" options={{ title: 'Create Organization', presentation: 'modal' }} />
      <Stack.Screen name="join-org" options={{ title: 'Join Organization', presentation: 'modal' }} />
      <Stack.Screen name="org-pending" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="add-lesson" options={{ title: 'Add Lesson', presentation: 'modal' }} />
      <Stack.Screen name="edit-lesson" options={{ title: 'Edit Lesson', presentation: 'modal' }} />
      <Stack.Screen name="location-picker" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="school/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="payroll" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="lesson/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="school/[id]/students" options={{ headerShown: false }} />
      <Stack.Screen name="school/[id]/gallery" options={{ headerShown: false }} />
      <Stack.Screen name="admin/org-management" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [loaded, error] = useFonts({
    ...Ionicons.font,
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_700Bold,
    NotoSansArabic_400Regular,
    NotoSansArabic_500Medium,
    NotoSansArabic_700Bold,
    NotoSansHebrew_400Regular,
    NotoSansHebrew_500Medium,
    NotoSansHebrew_700Bold,
  });
  const segments = useSegments();

  useEffect(() => {
    initPromise?.then(() => setI18nReady(true)).catch(() => setI18nReady(true));
  }, []);

  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  // Safety valve: if fonts or i18n never resolve in 5 s, unblock the app
  useEffect(() => {
    const t = setTimeout(() => setFontsTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ready = (loaded || error || fontsTimedOut || Platform.OS === 'web') && (i18nReady || fontsTimedOut);
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, i18nReady, fontsTimedOut]);

  if ((!loaded && !fontsTimedOut && !error) && (!i18nReady && !fontsTimedOut) && Platform.OS !== 'web') return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <OrgProvider>
          <LessonProvider>
            <AuthGuard>
              <OrgGuard>
                <RootLayoutNav />
              </OrgGuard>
            </AuthGuard>
          </LessonProvider>
        </OrgProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
