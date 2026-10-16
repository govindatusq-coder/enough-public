import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { IdentificationCard, Timer, LinkSimple } from 'phosphor-react-native';
import { Background, Glass, Kicker, PrimaryButton, TextButton, BottomBar, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { PSYCH } from '../src/logic';
import { toast } from '../src/toast';

/** Step 2 of 4 — confirm the psychologist behind a (mock) single-use invite link (COMPLIANCE_REVIEW D3). */
export default function Link() {
  const set = useStore((s) => s.set);
  const top = useTop();
  return (
    <Background>
      <ScrollView contentContainerStyle={{ paddingTop: top + 19, paddingHorizontal: 22, paddingBottom: 16, gap: 18 }}>
        <View>
          <Kicker>Step 2 of 4</Kicker>
          <Text style={[T.h1, { marginVertical: 8 }]}>Confirm your psychologist</Text>
          <Text style={T.muted}>You opened an invite link. Check these details match the psychologist you’re seeing.</Text>
        </View>
        <Glass style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.serifMed, fontSize: 17, color: colors.cream }}>{PSYCH.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.serif, fontSize: 22, lineHeight: 26, color: colors.navy }}>{PSYCH.name}</Text>
              <Text style={T.meta}>{PSYCH.title} · {PSYCH.practice}</Text>
            </View>
          </View>
          <View style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#0f274614' }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><IdentificationCard size={17} weight="light" color={colors.slate} /><Text style={T.meta}>Ahpra registration {PSYCH.ahpra}</Text></View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Timer size={17} weight="light" color={colors.slate} /><Text style={T.meta}>Single-use invite · expires in 47 hours</Text></View>
          </View>
        </Glass>
        <Text style={[T.muted, { fontSize: 15, lineHeight: 22, paddingHorizontal: 4 }]}>Only link with a psychologist you’re seeing. You can end sharing at any time in Settings.</Text>
      </ScrollView>
      <BottomBar style={{ paddingTop: 10, gap: 4, alignItems: 'center' }}>
        <PrimaryButton label={'Yes, link with ' + PSYCH.short} icon={<LinkSimple size={20} weight="light" color={colors.cream} />} style={{ alignSelf: 'stretch' }}
          onPress={() => { set({ linked: true }); router.push('/applock'); }} />
        <TextButton label="This isn’t my psychologist" onPress={() => { toast('Not linked. Ask your psychologist for a new invite.'); router.back(); }} />
      </BottomBar>
    </Background>
  );
}
