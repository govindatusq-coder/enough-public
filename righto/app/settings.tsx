import { ScrollView, Text, View, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, Toggle, T, F } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { cancelAll } from '../src/notifications';
import { toast } from '../src/toast';
import { cloudActive, cloudEmail, signOut, useCloud } from '../src/backend/cloud';

const PURPOSE = 'Righto lets psychologists and psychiatrists send homework to their clients. Clients plan when to do it, get reminders, and record what they did and learned. Clinicians can view what clients choose to share. Righto does not assess, diagnose, monitor, predict or treat any condition, and it is not monitored in real time.';

export default function Settings() {
  const role = useStore((s) => s.role);
  const set = useStore((s) => s.set);
  const resetDemo = useStore((s) => s.resetDemo);
  const profile = useCloud((c) => c.profile);
  const cloud = cloudActive();
  const doSignOut = () => Alert.alert('Sign out?', 'Your homework stays safely in your account. Reminders on this phone are cancelled until you sign in again.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { await cancelAll(); await signOut(); if (router.canDismiss()) router.dismissAll(); router.replace('/account'); } }]);

  const switchRole = (psych: boolean) => {
    set({ role: psych ? 'psych' : 'client' });
    if (router.canDismiss()) router.dismissAll();
    router.replace(psych ? '/psych' : '/home');
  };
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
                <Text style={T.body}>{profile?.display_name}</Text>
                <Text style={T.meta}>{cloudEmail()} · {profile?.role === 'psych' ? 'Psychologist' : 'Client'} · stored in Sydney</Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>View as psychologist</Text>
                <Text style={T.meta}>For testing. Switches between Sam’s view and Dr Chen’s.</Text>
              </View>
              <Toggle on={role === 'psych'} onChange={switchRole} label="View as psychologist" />
            </View>
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
          ) : (
            <Pressable onPress={reset} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#0f274612' }}>
              <View style={{ flex: 1 }}>
                <Text style={T.body}>Reset demo data</Text>
                <Text style={T.meta}>Restores the sample homework and check-ins.</Text>
              </View>
            </Pressable>
          )}
        </Glass>
        <View style={{ paddingHorizontal: 4, gap: 6 }}>
          <Kicker>About Righto</Kicker>
          <Text style={T.muted}>{PURPOSE}</Text>
          <Text style={[T.small, { fontFamily: F.serif }]}>Version 0.2.0 · {cloud ? 'Connected to the Righto project in Sydney.' : 'Prototype with sample data. Not for real clients yet.'}</Text>
        </View>
      </ScrollView>
    </Background>
  );
}
