import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Background, Kicker, PrimaryButton, TextButton, BottomBar, CheckRow, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { requestPermission } from '../src/notifications';

/** Small lock-screen notification preview, used here and in Privacy & data. */
export function NotifPreview({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffffa8', shadowColor: colors.navy, shadowOpacity: 0.08, shadowRadius: 35, shadowOffset: { width: 0, height: 8 } }}>
      <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} colors={['#fbf8f1e0', '#f6e7d6c8']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingBottom: 4 }}>
          <Text style={{ fontFamily: F.script, fontSize: 30, lineHeight: 34, color: colors.cream }}>r</Text>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.champagneLight, marginLeft: 2, marginTop: 10 }} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: F.sans, fontSize: 11, letterSpacing: 1, color: colors.slateLight }}>RIGHTO</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 11, letterSpacing: 1, color: colors.slateLight }}>now</Text>
          </View>
          <Text style={{ fontFamily: F.serifMed, fontSize: 15, lineHeight: 20, color: colors.navy }}>{title}</Text>
          <Text style={{ fontFamily: F.serif, fontSize: 13, lineHeight: 18, color: colors.slate }}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

/** Step 4 of 4 — reminder primer before the OS prompt; private lock-screen copy by default (PRIVACY.md §3.3, §4). */
export default function Notifs() {
  const set = useStore((s) => s.set);
  const notifDetail = useStore((s) => s.notifDetail);
  const top = useTop();
  const finish = (allowed: boolean) => { set({ notifsAllowed: allowed, onboarded: true }); router.replace('/home'); };
  return (
    <Background>
      <ScrollView contentContainerStyle={{ paddingTop: top + 19, paddingHorizontal: 22, paddingBottom: 16, gap: 18 }}>
        <View>
          <Kicker>Step 4 of 4</Kicker>
          <Text style={[T.h1, { marginVertical: 8 }]}>Gentle reminders</Text>
          <Text style={T.muted}>We’ll remind you at the times you choose. On your lock screen they won’t say what the task is.</Text>
        </View>
        <NotifPreview title={notifDetail ? 'Finished lunch? Time for your walk.' : 'Time for your lunch break routine.'} body={notifDetail ? 'Walk for 10 minutes, around the block near work.' : 'Details hidden until you unlock'} />
        <CheckRow on={notifDetail} onPress={() => set({ notifDetail: !notifDetail })} label="Show task details on my lock screen" />
      </ScrollView>
      <BottomBar style={{ paddingTop: 10, gap: 4, alignItems: 'center' }}>
        <PrimaryButton label="Allow reminders" icon={<Bell size={20} weight="light" color={colors.cream} />} style={{ alignSelf: 'stretch' }} onPress={async () => finish(await requestPermission())} />
        <TextButton label="Not now" onPress={() => finish(false)} />
      </BottomBar>
    </Background>
  );
}
