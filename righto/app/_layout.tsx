import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, View, Text } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockSimpleOpen } from 'phosphor-react-native';
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { MsMadi_400Regular } from '@expo-google-fonts/ms-madi';
import { Background, Logo, PrimaryButton, T } from '../src/ui';
import { ToastHost, toast } from '../src/toast';
import { useStore } from '../src/store';
import { ACTION, setupNotifications } from '../src/notifications';
import { colors } from '../src/theme';
import { bootstrapCloud, cloudActive, isPsych, pullClient, refreshLink } from '../src/backend/cloud';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function Layout() {
  const [fontsOk] = useFonts({ Newsreader_400Regular, Newsreader_500Medium, Newsreader_400Regular_Italic, DMSans_500Medium, MsMadi_400Regular });
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (fontsOk && hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsOk, hydrated]);

  if (!fontsOk || !hydrated) return <View style={{ flex: 1, backgroundColor: colors.cream }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <DayRoller />
      <CloudSync />
      <NotificationResponses />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: 'fade', animationDuration: 380, gestureEnabled: true, fullScreenGestureEnabled: true }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" options={{ animation: 'fade' }} />
        <Stack.Screen name="journal" options={{ animation: 'fade' }} />
        <Stack.Screen name="psych/index" options={{ animation: 'fade' }} />
        <Stack.Screen name="support" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="sheet" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="legal" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      </Stack>
      <ToastHost />
      <LockGate />
    </SafeAreaProvider>
  );
}

/** Restores the account on launch and keeps a client's homework in step with the project while the app is open. */
function CloudSync() {
  useEffect(() => {
    bootstrapCloud().catch(() => undefined);
    const sync = () => { if (cloudActive() && !isPsych()) { pullClient().catch(() => undefined); refreshLink().catch(() => undefined); } };
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') sync(); });
    const iv = setInterval(() => { if (AppState.currentState === 'active') sync(); }, 45000);
    return () => { sub.remove(); clearInterval(iv); };
  }, []);
  return null;
}

/** Clears each task's "today" outcome at local midnight (README: reset at local midnight). */
function DayRoller() {
  const rollDay = useStore((s) => s.rollDay);
  useEffect(() => {
    rollDay();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') rollDay(); });
    return () => sub.remove();
  }, [rollDay]);
  return null;
}

/** Handles taps and action buttons on local notifications (Done / Not today / Start / Do it now / Do it later). */
function NotificationResponses() {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    setupNotifications();
    const handle = (r: Notifications.NotificationResponse) => {
      const key = r.notification.request.identifier + '|' + r.actionIdentifier + '|' + r.notification.date;
      if (handled.current === key) return;
      handled.current = key;
      const data = (r.notification.request.content.data || {}) as { taskId?: string; kind?: string };
      const id = data.taskId;
      if (!id) return;
      const s = useStore.getState();
      const task = s.tasks.find((t) => t.id === id);
      if (!task) return;
      const a = r.actionIdentifier;
      if (a === ACTION.done || a === ACTION.missed) {
        s.record(id, a === ACTION.done ? 'done' : 'missed', '', '', s.shareDefault);
        if (a === ACTION.missed) toast('No problem. See you tomorrow.');
        return;
      }
      if (a === ACTION.start || a === ACTION.now) { router.push({ pathname: '/now/[id]', params: { id } }); return; }
      if (a === ACTION.options) { router.push({ pathname: '/task/[id]', params: { id, later: '1' } }); return; }
      if (data.kind === 'new' || data.kind === 'nudge' || task.status === 'new' || task.status === 'later') { router.push({ pathname: '/task/[id]', params: { id } }); return; }
      router.push({ pathname: '/now/[id]', params: { id } });
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync?.().then((r) => { if (r) handle(r); }).catch(() => undefined);
    return () => sub.remove();
  }, []);
  return null;
}

/**
 * App lock (PRIVACY.md APP 11): Face ID / passcode on launch and after `lockAfter` minutes in the background,
 * plus an opaque privacy overlay whenever the app is inactive so the app switcher never shows content.
 */
function LockGate() {
  const appLock = useStore((s) => s.appLock);
  const lockAfter = useStore((s) => s.lockAfter);
  const onboarded = useStore((s) => s.onboarded);
  const enabled = appLock && onboarded;
  const [locked, setLocked] = useState(enabled);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const bgAt = useRef<number | null>(null);
  const authing = useRef(false);

  useEffect(() => { if (!enabled) setLocked(false); }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st: AppStateStatus) => {
      if (st === 'active') {
        setHidden(false);
        if (enabled && bgAt.current != null && !authing.current) {
          const mins = (Date.now() - bgAt.current) / 60000;
          if (mins >= lockAfter) setLocked(true);
        }
        bgAt.current = null;
      } else {
        setHidden(true);
        if (st === 'background' && !authing.current && bgAt.current == null) bgAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [enabled, lockAfter]);

  const unlock = async () => {
    if (authing.current) return;
    authing.current = true;
    setFailed(false);
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (!enrolled && level === LocalAuthentication.SecurityLevel.NONE) { setLocked(false); return; } // no device security → nothing to check against
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Righto', cancelLabel: 'Cancel' });
      if (res.success) setLocked(false); else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      authing.current = false;
    }
  };

  useEffect(() => { if (locked) unlock(); }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!locked && !hidden) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <Background>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80, gap: 22 }}>
          <Logo size={64} />
          {locked && !hidden ? (
            <>
              <Text style={[T.muted, { textAlign: 'center' }]}>{failed ? 'Couldn’t unlock. Try again.' : 'Locked to keep your homework and notes private.'}</Text>
              <PrimaryButton label="Unlock" icon={<LockSimpleOpen size={20} weight="light" color={colors.cream} />} onPress={unlock} style={{ alignSelf: 'stretch' }} />
            </>
          ) : null}
        </View>
      </Background>
    </View>
  );
}
