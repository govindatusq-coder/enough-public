import { ScrollView, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CaretRight, GearSix } from 'phosphor-react-native';
import { Background, Glass, Kicker, HomeLogo, TabBar, T, F, useTop } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore } from '../../src/store';
import { CLIENT, PSYCH, OTHER_CLIENTS } from '../../src/logic';

/** Psychologist · Clients. Counts of records only, no interpretation (INTENDED_PURPOSE.md rule 4). */
export default function Clients() {
  const tasks = useStore((s) => s.tasks);
  const history = useStore((s) => s.history);
  const top = useTop();
  const shared = history.filter((h) => h.shared);
  const samDone = shared.filter((h) => h.outcome !== 'missed').length;
  const routines = tasks.filter((t) => t.status === 'planned' && t.kind === 'commitment').length;
  const goals = tasks.filter((t) => t.status === 'planned' && t.kind === 'goal').length;
  const parts = [routines ? routines + (routines > 1 ? ' routines' : ' routine') : '', goals ? goals + (goals > 1 ? ' goals' : ' goal') : ''].filter(Boolean);
  const samLine = (parts.length ? parts.join(', ') : 'No plans yet') + (shared[0] ? ' · checked in ' + shared[0].label.split(' ')[0] : '');
  const clients = [{ name: CLIENT.name, ini: CLIENT.initials, line: samLine, done: samDone, of: shared.length }, ...OTHER_CLIENTS];

  return (
    <Background>
      <View style={{ paddingTop: top + 9, paddingHorizontal: 22, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <HomeLogo size={34} style={{ marginLeft: -6 }} />
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 }}>
            <GearSix size={20} weight="light" color={colors.slate} />
          </Pressable>
        </View>
        <Kicker>{PSYCH.name}</Kicker>
        <Text style={[T.h1, { fontSize: 36, lineHeight: 40, marginTop: 6 }]}>Your clients</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 120, gap: 10 }}>
        {clients.map((c) => {
          const pct = c.of ? Math.round((c.done / c.of) * 100) : 0;
          return (
            <Pressable key={c.name} onPress={() => router.push({ pathname: '/psych/[client]', params: { client: c.name } })} accessibilityRole="button" accessibilityLabel={c.name + '. ' + c.line + '. ' + (c.of ? c.done + ' of ' + c.of + ' done' : 'No check-ins yet')}>
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
