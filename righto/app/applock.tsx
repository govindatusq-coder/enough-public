import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Alert } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { ScanSmiley, Fingerprint, LockSimple } from 'phosphor-react-native';
import { Background, Glass, Kicker, PrimaryButton, SecondaryButton, TextButton, BottomBar, T, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { toast } from '../src/toast';
import { cloudMode } from '../src/backend/cloud';

/** Step 3 of 4 — app lock, on by default (PRIVACY.md APP 11). */
export default function AppLock() {
  const set = useStore((s) => s.set);
  const top = useTop();
  const [bio, setBio] = useState<'face' | 'finger' | 'none'>('none');

  useEffect(() => {
    (async () => {
      try {
        if (!(await LocalAuthentication.hasHardwareAsync())) return;
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBio(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'face' : types.length ? 'finger' : 'none');
      } catch { /* leave as none */ }
    })();
  }, []);

  const enable = async (passcodeOnly: boolean) => {
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (!enrolled && level === LocalAuthentication.SecurityLevel.NONE) {
        Alert.alert('Set a device passcode first', 'Rightyo uses your phone’s own lock. Add a passcode or Face ID in your phone’s Settings, then turn on app lock in Rightyo’s Privacy & data.',
          [{ text: 'Continue without lock', onPress: () => { set({ appLock: false }); router.push('/notifs'); } }, { text: 'OK' }]);
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Lock Rightyo with this', disableDeviceFallback: false, ...(passcodeOnly ? { biometricsSecurityLevel: 'weak' as const } : {}) });
      if (res.success) { set({ appLock: true, lockAfter: 5 }); toast('App lock is on.'); router.push('/notifs'); }
    } catch {
      toast('Couldn’t set up app lock. You can try again in Settings.');
    }
  };

  const BioIcon = bio === 'finger' ? Fingerprint : ScanSmiley;
  const bioLabel = bio === 'finger' ? 'Use fingerprint' : 'Use Face ID';

  return (
    <Background>
      <ScrollView contentContainerStyle={{ paddingTop: top + 19, paddingHorizontal: 22, paddingBottom: 16, gap: 22 }}>
        <View>
          <Kicker>{cloudMode() ? 'Step 4 of 5' : 'Step 3 of 4'}</Kicker>
          <Text style={[T.h1, { marginVertical: 8 }]}>Keep Rightyo private</Text>
          <Text style={T.muted}>Lock the app so no one else who picks up your phone can read your homework or notes.</Text>
        </View>
        <Glass style={{ alignSelf: 'center', width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          {bio === 'none' ? <LockSimple size={56} weight="light" color={colors.navy} /> : <BioIcon size={56} weight="light" color={colors.navy} />}
        </Glass>
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text style={[T.meta, { lineHeight: 20 }]}>Locks again after 5 minutes in the background.</Text>
          <Text style={[T.meta, { lineHeight: 20 }]}>Rightyo is hidden in the app switcher.</Text>
        </View>
      </ScrollView>
      <BottomBar style={{ paddingTop: 10, gap: 10, alignItems: 'center' }}>
        {bio !== 'none' && <PrimaryButton label={bioLabel} icon={<BioIcon size={20} weight="light" color={colors.cream} />} style={{ alignSelf: 'stretch' }} onPress={() => enable(false)} />}
        <SecondaryButton label="Set a passcode" style={{ alignSelf: 'stretch' }} onPress={() => enable(true)} />
        <TextButton label="Skip for now" style={{ minHeight: 36 }} onPress={() => { set({ appLock: false }); router.push('/notifs'); }} />
      </BottomBar>
    </Background>
  );
}
