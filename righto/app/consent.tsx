import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LockSimple, MapPin, EyeSlash, ClockCountdown, Info } from 'phosphor-react-native';
import { Background, Glass, Kicker, Logo, PrimaryButton, TextButton, BottomBar, CheckRow, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore, CONSENT_VERSION } from '../src/store';
import { toast } from '../src/toast';

const rows = [
  [LockSimple, 'Locked with Face ID or a passcode.'],
  [MapPin, 'Stored in Australia. Never sold or used for advertising.'],
  [EyeSlash, 'You choose what your psychologist sees.'],
  [ClockCountdown, 'Not monitored in real time. For urgent help call 000 or Lifeline 13 11 14.'],
  [Info, 'Righto doesn’t assess, diagnose or treat. It helps you do the homework you plan in session.'],
] as const;

/** Step 1 of 4 — express consent before any health information is collected (APP 3, APP 5, PsyBA code B1). */
export default function Consent() {
  const set = useStore((s) => s.set);
  const shareDefault = useStore((s) => s.shareDefault);
  const [ok, setOk] = useState(false);
  const top = useTop();
  return (
    <Background>
      <ScrollView contentContainerStyle={{ paddingTop: top + 19, paddingHorizontal: 22, paddingBottom: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Logo size={34} />
        <View>
          <Kicker>Step 1 of 4 · Before you start</Kicker>
          <Text style={[T.h1, { marginVertical: 8 }]}>Your privacy</Text>
          <Text style={T.muted}>Righto keeps your homework, notes and check-ins private. Only you, and the psychologist you link with, can see what you choose to share.</Text>
        </View>
        <Glass style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
          {rows.map(([Icon, txt], i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#0f274612' }}>
              <Icon size={22} weight="light" color={colors.steel} style={{ marginTop: 1 }} />
              <Text style={[T.body16, { flex: 1 }]}>{txt}</Text>
            </View>
          ))}
        </Glass>
        <View style={{ flexDirection: 'row', gap: 18, paddingHorizontal: 4 }}>
          {([['policy', 'Privacy policy'], ['notice', 'Collection notice']] as const).map(([k, l]) => (
            <Pressable key={k} accessibilityRole="link" onPress={() => router.push({ pathname: '/legal', params: { kind: k } })} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.serif, fontSize: 15, color: colors.navy, textDecorationLine: 'underline', textDecorationColor: '#0F274640' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <CheckRow on={ok} onPress={() => setOk(!ok)} label="I agree to Righto collecting and storing my health information so I can share homework with my psychologist." />
        <CheckRow on={shareDefault} onPress={() => set({ shareDefault: !shareDefault })} label="Share my check-ins with my psychologist by default. I can change this each time." />
      </ScrollView>
      <BottomBar style={{ paddingTop: 10, gap: 4, alignItems: 'center' }}>
        <PrimaryButton label="Agree and continue" disabled={!ok} style={{ alignSelf: 'stretch' }}
          onPress={() => { set({ consentAt: new Date().toISOString(), consentVersion: CONSENT_VERSION }); router.push('/link'); }} />
        <TextButton label="Not now" onPress={() => { toast('Nothing has been saved. Come back when you’re ready.'); router.replace('/'); }} />
      </BottomBar>
    </Background>
  );
}
