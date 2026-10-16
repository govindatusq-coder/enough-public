import { ScrollView, Text, View, Pressable, Alert, Share, Linking } from 'react-native';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { CaretRight, DownloadSimple, Trash, LinkBreak } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, Toggle, Chip, SecondaryButton, T, F } from '../src/ui';
import { colors } from '../src/theme';
import { useStore, STORE_NAME, type LockAfter } from '../src/store';
import { PSYCH, notifCopy } from '../src/logic';
import { NotifPreview } from './notifs';
import { scheduleCommitment, scheduleGoal, cancelAll } from '../src/notifications';
import { wipeLocalData } from '../src/storage';
import { toast } from '../src/toast';

function Row({ title, sub, right, onPress, first }: { title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; first?: boolean }) {
  const inner = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={T.body}>{title}</Text>
        {sub ? <Text style={[T.meta, { lineHeight: 19 }]}>{sub}</Text> : null}
      </View>
      {right}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, minHeight: 60, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: '#0f274612' };
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={style}>{inner}</Pressable> : <View style={style}>{inner}</View>;
}

/** Settings → Privacy & data (PRIVACY.md §3.4, APP 12 access, APP 13 correction, retention). */
export default function Privacy() {
  const s = useStore();
  const sample = s.tasks.find((t) => t.status === 'planned' && t.kind === 'commitment') || s.tasks[0];
  const copy = sample ? notifCopy('commitment', sample, s.notifDetail) : { title: 'Righto', body: 'Time for your routine.' };
  const preview = s.notifDetail ? copy : { title: copy.body, body: 'Details hidden until you unlock' };

  const setDetail = async (v: boolean) => {
    s.set({ notifDetail: v });
    for (const t of s.tasks.filter((x) => x.status === 'planned')) {
      const ids = t.kind === 'goal' ? await scheduleGoal(t, v) : await scheduleCommitment(t, v);
      s.patchTask(t.id, { notifIds: ids });
    }
  };
  const setLock = async (v: boolean) => {
    if (!v) { s.set({ appLock: false }); return; }
    try {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Lock Righto with this' });
      if (res.success) s.set({ appLock: true }); else toast('App lock stays off.');
    } catch { toast('App lock isn’t available on this device.'); }
  };
  const unlink = () => Alert.alert('End sharing with ' + PSYCH.short + '?', 'They lose access to anything new from now on. What you already shared stays in their clinical record.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'End sharing', style: 'destructive', onPress: () => { s.set({ linked: false, shareDefault: false }); toast('Sharing ended. Nothing new will be shared.'); } }]);
  const download = async () => {
    const { set: _a, patchTask: _b, addTask: _c, record: _d, rollDay: _e, resetDemo: _f, wipe: _g, ...data } = s;
    try { await Share.share({ message: JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), title: 'My Righto data' }); } catch { /* cancelled */ }
  };
  const del = () => Alert.alert('Delete my account?', 'Your homework, plans and check-ins are deleted from this device now and from Righto’s servers within 30 days (backups within 35 days). Your psychologist keeps their own clinical record.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', style: 'destructive', onPress: () => Alert.alert('This can’t be undone', 'Delete everything?',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await cancelAll(); s.wipe(); await wipeLocalData(STORE_NAME); if (router.canDismiss()) router.dismissAll(); router.replace('/'); } }]) }]);

  return (
    <Background>
      <BackRow label="Settings" />
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 40, gap: 16 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Kicker>Privacy & data</Kicker>
          <Text style={[T.h1, { marginTop: 8 }]}>Privacy & data</Text>
        </View>

        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Row first title="Show task details in notifications" sub="Off by default. Lock-screen reminders then only say it’s time for your routine." right={<Toggle on={s.notifDetail} onChange={setDetail} label="Show task details in notifications" />} />
          <View style={{ paddingBottom: 12 }}><NotifPreview title={preview.title} body={preview.body} /></View>
        </Glass>

        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Row first title="Share check-ins with my psychologist by default" sub="You can still change it on each check-in." right={<Toggle on={s.shareDefault} onChange={(v) => s.set({ shareDefault: v })} label="Share check-ins by default" />} />
          <Row title="“What feels doable right now?”" sub="Stays on this phone. Never stored, scored or shared." />
        </Glass>

        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Row first title="App lock" sub="Face ID, fingerprint or your phone’s passcode." right={<Toggle on={s.appLock} onChange={setLock} label="App lock" />} />
          <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#0f274612', gap: 8 }}>
            <Text style={T.meta}>Lock after</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([[0, 'Immediately'], [1, '1 min'], [5, '5 min']] as [LockAfter, string][]).map(([v, l]) => <Chip key={v} label={l} selected={s.lockAfter === v} onPress={() => s.set({ lockAfter: v })} />)}
            </View>
          </View>
        </Glass>

        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Row first title={s.linked ? PSYCH.name + ' · ' + PSYCH.title : 'No psychologist linked'} sub={s.linked ? PSYCH.practice + ' · Ahpra ' + PSYCH.ahpra : 'Ask your psychologist for an invite link.'}
            right={s.linked ? <SecondaryButton label="Unlink" size={15} icon={<LinkBreak size={16} weight="light" color={colors.navy} />} onPress={unlink} style={{ minHeight: 40, paddingHorizontal: 14 }} /> : undefined} />
        </Glass>

        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Row first title="Download my data" sub="Everything Righto holds about you, as JSON, via the share sheet." onPress={download} right={<DownloadSimple size={20} weight="light" color={colors.navy} />} />
          <Row title="Delete my account" sub="Two steps. Explains what is kept and for how long." onPress={del} right={<Trash size={20} weight="light" color={colors.navy} />} />
        </Glass>

        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <Row first title="Privacy policy" onPress={() => router.push({ pathname: '/legal', params: { kind: 'policy' } })} right={<CaretRight size={18} weight="light" color={colors.navy} />} />
          <Row title="Collection notice" onPress={() => router.push({ pathname: '/legal', params: { kind: 'notice' } })} right={<CaretRight size={18} weight="light" color={colors.navy} />} />
          <Row title="Contact privacy officer" sub="privacy@righto.app" onPress={() => Linking.openURL('mailto:privacy@righto.app?subject=Righto%20privacy')} right={<CaretRight size={18} weight="light" color={colors.navy} />} />
        </Glass>
        <Text style={[T.small, { paddingHorizontal: 4, fontFamily: F.serif }]}>Consent {s.consentVersion ? 'v' + s.consentVersion : 'not yet given'}{s.consentAt ? ' · ' + new Date(s.consentAt).toLocaleDateString('en-AU') : ''}</Text>
      </ScrollView>
    </Background>
  );
}
