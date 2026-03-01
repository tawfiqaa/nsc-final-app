import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { LessonProvider } from '../src/contexts/LessonContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';

// Keep the splash screen visible while we fetch resources  -- Check if preventAutoHideAsync is available
SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // If not logged in and not at login, go to login
      if (segments[0] !== 'login') {
        router.replace('/login');
      }
    } else {
      // User is logged in
      if (!user.isApproved) {
        if (segments[0] !== 'awaiting-approval') {
          router.replace('/awaiting-approval');
        }
      } else {
        // If logged in and approved
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

function RootLayoutNav() {
  const { colors } = useTheme();

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="add-lesson" options={{ title: 'Add Lesson', presentation: 'modal' }} />
      <Stack.Screen name="edit-lesson" options={{ title: 'Edit Lesson', presentation: 'modal' }} />
      <Stack.Screen name="payroll" options={{ title: 'Payroll Report', headerTitle: 'Payroll Report' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    if (loaded || error || Platform.OS === 'web') {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // On web, we rely on the CDN in +html.tsx, so we don't wait for 'loaded'
  if (!loaded && Platform.OS !== 'web') return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <LessonProvider>
          <AuthGuard>
            <RootLayoutNav />
          </AuthGuard>
        </LessonProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
