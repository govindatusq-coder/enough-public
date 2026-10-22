import { useCallback, useState } from 'react';
import { ScrollView, Text, View, Pressable, Alert, Share } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CaretRight, GearSix, UserPlus } from 'phosphor-react-native';
import { Background, Glass, Kicker, HomeLogo, TabBar, SecondaryButton, T, F, useTop } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore } from '../../src/store';
import { CLIENT, PSYCH, OTHER_CLIENTS, dayLabel } from '../../src/logic';
import { cloudActive, useCloud } from '../../src/backend/cloud';
import { api } from '../../src/backend/supabase';
import { toast } from '../../src/toast';

type Row = { id: string; name: string; ini: string; line: string; done: number; of: number };
const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'R';

/** Psychologist · Clients. Counts of records only, no interpretation (INTENDED_PURPOSE.md rule 4). */
export default function Clients() {
  const tasks = useStore((s) => s.tasks);
  const history = useStore((s) => s.history);
  const profile = useCloud((c) => c.profile);
  const top = useTop();
  const cloud = cloudActive();
  const [live, setLive] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    if (!cloud) return;
    api.myClients().then((rows) => {
      setErr('');
      setLive(rows.map((r) => ({ id: r.client_id, name: r.display_name, ini: initialsOf(r.display_name), done: r.checkins_done, of: r.checkins_total,
        line: (r.last_checkin ? 'Checked in ' + dayLabel(new Date(r.last_checkin)) : 'Linked ' + dayLabel(new Date(r.linked_at))) + (r.next_session ? ' · next session ' + dayLabel(new Date(r.next_session)) : '') })));
    }).catch((e: Error) => {
      if (/multi-factor/i.test(e.message)) router.replace('/mfa'); else setErr(e.message);
    });
  }, [cloud]);
  useFocusEffect(load);

  const invite = async () => {
    try {
      const { code, expires_at } = await api.createInvite();
      const hrs = Math.round((new Date(expires_at).getTime() - Date.now()) / 3600000);
      Alert.alert('Invite code: ' + code, 'Give this to your client in session. It works once and expires in ' + hrs + ' hours. In Rightyo they tap Settings → Privacy & data → Link with a psychologist, or enter it when they first set up.',
        [{ text: 'Done' }, { text: 'Share…', onPress: () => Share.share({ message: 'Your Rightyo invite code is ' + code + '. It works once and expires in ' + hrs + ' hours. Install Rightyo, create an account, then enter the code.' }).catch(() => undefined) }]);
    } catch (e) { toast((e as Error).message); }
  };

  // Local sample mode keeps the mock list.
  const shared = history.filter((h) => h.shared);
  const samDone = shared.filter((h) => h.outcome !== 'missed').length;
  const routines = tasks.filter((t) => t.status === 'planned' && t.kind === 'commitment').length;
  const goals = tasks.filter((t) => t.status === 'planned' && t.kind === 'goal').length;
  const parts = [routines ? routines + (routines > 1 ? ' routines' : ' routine') : '', goals ? goals + (goals > 1 ? ' goals' : ' goal') : ''].filter(Boolean);
  const samLine = (parts.length ? parts.join(', ') : 'No plans yet') + (shared[0] ? ' · checked in ' + shared[0].label.split(' ')[0] : '');
  const mock: Row[] = [{ id: '', name: CLIENT.name, ini: CLIENT.initials, line: samLine, done: samDone, of: shared.length }, ...OTHER_CLIENTS.map((c) => ({ id: '', ...c }))];
  const clients = cloud ? live ?? [] : mock;

  return (
    <Background>
      <View style={{ paddingTop: top + 9, paddingHorizontal: 22, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <HomeLogo size={34} style={{ marginLeft: -6 }} />
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fbf8f1a0', borderWidth: 1, borderColor: '#0F274633', alignItems: 'center', justifyContent: 'center' }}><GearSix size={20} weight="light" color={colors.navy} /></View>
          </Pressable>
        </View>
        <Kicker>{profile?.display_name ?? PSYCH.name}</Kicker>
        <Text style={[T.h1, { fontSize: 36, lineHeight: 40, marginTop: 6 }]}>Your clients</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 120, gap: 10 }}>
        {cloud && <SecondaryButton label="Invite a client" icon={<UserPlus size={18} weight="light" color={colors.navy} />} onPress={invite} style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, marginBottom: 4 }} />}
        {err ? <Text style={[T.meta, { paddingHorizontal: 4, fontFamily: F.serifIt }]}>{err}</Text> : null}
        {cloud && live && live.length === 0 && !err && <Text style={[T.muted, { paddingHorizontal: 4 }]}>No clients linked yet. Create an invite code and give it to a client in session.</Text>}
        {cloud && !live && !err && <Text style={[T.meta, { paddingHorizontal: 4 }]}>Loading…</Text>}
        {clients.map((c) => {
          const pct = c.of ? Math.round((c.done / c.of) * 100) : 0;
          return (
            <Pressable key={c.id || c.name} onPress={() => router.push({ pathname: '/psych/[client]', params: { client: c.name, id: c.id } })} accessibilityRole="button" accessibilityLabel={c.name + '. ' + c.line + '. ' + (c.of ? c.done + ' of ' + c.of + ' done' : 'No check-ins yet')}>
              <Glass style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 72 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.serifMed, fontSize: 15, color: colors.cream }}>{c.ini}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontFamily: F.serif, fontSize: 21, lineHeight: 24, color: colors.navy }}>{c.name}</Text>
                  <Text style={T.meta}>{c.line}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: '#0f27461a', overflow: 'hidden' }}>
                      <View style={{ width: `${pct}%` as `${number}%`, height: '100%', borderRadius: 3, backgroundColor: colors.navy }} />
                    </View>
                    <Text style={T.small}>{c.of ? c.done + ' of ' + c.of + ' done' : 'No check-ins yet'}</Text>
                  </View>
                </View>
                <CaretRight size={18} weight="light" color={colors.navy} />
              </Glass>
            </Pressable>
          );
        })}
      </ScrollView>
      <TabBar active="clients" />
    </Background>
  );
}
