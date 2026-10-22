import { useState } from 'react';
import { ScrollView, Text, View, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, Toggle, T, F } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { capWords, PSYCH } from '../src/logic';
import { cancelAll } from '../src/notifications';
import { toast } from '../src/toast';
import * as Updates from 'expo-updates';
import { cloudActive, cloudMode, cloudEmail, signOut, useCloud } from '../src/backend/cloud';

const PURPOSE = 'Best of You lets psychologists and psychiatrists send homework to their clients. Clients plan when to do it, get reminders, and record what they did and learned. Clinicians can view what clients choose to share. Best of You does not assess, diagnose, monitor, predict or treat any condition, and it is not monitored in real time.';

export default function Settings() {
  const role = useStore((s) => s.role);
  const set = useStore((s) => s.set);
  const resetDemo = useStore((s) => s.resetDemo);
  const profile = useCloud((c) => c.profile);
  const cloud = cloudActive();
  const guest = cloudMode() && !cloud; // backend available, but using Best of You without an account
  const linked = useStore((s) => s.linked);
  const psychRole = cloud && profile?.role === 'psych';
  // Clients: who they are linked with, or where to link. Linking needs an account; the code is entered on the invite screen.
  const goLink = () => router.push(guest ? { pathname: '/account', params: { from: 'settings' } } : { pathname: '/link', params: { from: 'settings' } });
  const doSignOut = () => Alert.alert('Sign out?', 'Your homework stays safely in your account. Reminders on this phone are cancelled until you sign in again.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { await cancelAll(); await signOut(); if (router.canDismiss()) router.dismissAll(); router.replace('/account'); } }]);

  const switchRole = (psych: boolean) => {
    set({ role: psych ? 'psych' : 'client' });
    if (router.canDismiss()) router.dismissAll();
    router.replace(psych ? '/psych' : '/home');
  };
  const [checking, setChecking] = useState(false);
  /** Over-the-air updates: show what is running and let the person fetch the latest now, with the real reason if it fails. */
  const checkUpdates = async () => {
    if (!Updates.isEnabled) { toast('Updates are off in this build (development mode).'); return; }
    setChecking(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) { toast('You already have the latest version.'); return; }
      await Updates.fetchUpdateAsync();
      toast('Update downloaded. Restarting…');
      setTimeout(() => Updates.reloadAsync().catch((e: Error) => toast('Restart failed: ' + e.message)), 600);
    } catch (e) { Alert.alert('Couldn’t check for updates', (e as Error).message); }
    finally { setChecking(false); }
  };
  const running = Updates.updateId ? 'update ' + Updates.updateId.slice(0, 8) + (Updates.createdAt ? ' · ' + Updates.createdAt.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '') : 'built-in version';
  const reset = () => Alert.alert('Reset demo data?', 'Restores the sample tasks and check-ins. Your settings stay as they are.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: async () => { await cancelAll(); resetDemo(); toast('Demo data reset.'); } }]);

  return (
    <Background>
      <BackRow />
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 40, gap: 16 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Kicker>Settings</Kicker>
          <Text style={[T.h1, { marginTop: 8 }]}>Settings</Text>
        </View>
        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {cloud ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>{capWords(profile?.display_name ?? '')}</Text>
                <Text style={T.meta}>{cloudEmail()} · {profile?.role === 'psych' ? 'Psychologist' : 'Client'} · stored in Sydney</Text>
              </View>
            </View>
          ) : guest ? (
            <Pressable onPress={() => router.push({ pathname: '/account', params: { from: 'settings' } })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>Create an account or sign in</Text>
                <Text style={T.meta}>Keeps your homework if you change phones, and lets a psychologist send you homework. What you’ve done here comes with you.</Text>
              </View>
              <CaretRight size={18} weight="light" color={colors.navy} />
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>View as psychologist</Text>
                <Text style={T.meta}>For testing. Switches between Sam’s view and Dr Chen’s.</Text>
              </View>
              <Toggle on={role === 'psych'} onChange={switchRole} label="View as psychologist" />
            </View>
          )}
          {!psychRole && (
            <Pressable onPress={linked ? () => router.push('/privacy') : goLink} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#0f274612' }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>{linked ? 'Your psychologist' : 'Link with a psychologist or psychiatrist'}</Text>
                <Text style={T.meta}>{linked ? PSYCH.name + ' · ' + PSYCH.title + (PSYCH.practice ? ' · ' + PSYCH.practice : '') : guest ? 'Create an account first, then enter the invite code they give you.' : 'Enter the invite code they give you in session.'}</Text>
              </View>
              <CaretRight size={18} weight="light" color={colors.navy} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/privacy')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#0f274612' }}>
            <View style={{ flex: 1 }}>
              <Text style={T.body}>Privacy & data</Text>
              <Text style={T.meta}>Notifications, sharing, app lock, your data.</Text>
            </View>
            <CaretRight size={18} weight="light" color={colors.navy} />
          </Pressable>
          {cloud ? (
            <Pressable onPress={doSignOut} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#0f274612' }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>Sign out</Text>
                <Text style={T.meta}>Removes your homework from this phone. It stays in your account.</Text>
              </View>
            </Pressable>
          ) : guest ? null : (
            <Pressable onPress={reset} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#0f274612' }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>Reset demo data</Text>
                <Text style={T.meta}>Restores the sample homework and check-ins.</Text>
              </View>
            </Pressable>
          )}
        </Glass>
        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Pressable onPress={checkUpdates} disabled={checking} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={T.body}>{checking ? 'Checking…' : 'Check for updates'}</Text>
              <Text style={T.meta}>Running {running} · channel {Updates.channel || 'none'} · runtime {Updates.runtimeVersion || '?'}</Text>
            </View>
            <CaretRight size={18} weight="light" color={colors.navy} />
          </Pressable>
        </Glass>
        <View style={{ paddingHorizontal: 4, gap: 6 }}>
          <Kicker>About Best of You</Kicker>
          <Text style={T.muted}>{PURPOSE}</Text>
          <Text style={[T.small, { fontFamily: F.serif }]}>Version 0.2.0 · {cloud ? 'Connected to the Best of You project in Sydney.' : guest ? 'Using Best of You on this phone only.' : 'Prototype with sample data. Not for real clients yet.'}</Text>
        </View>
      </ScrollView>
    </Background>
  );
}
