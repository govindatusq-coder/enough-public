import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Background, Glass, Kicker, SupportLink, TabBar, SegBar, Seg, Pill, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { journalStats, learningOf, monthName, OUT } from '../src/logic';

/** Journal — counts of what was recorded, never interpreted (INTENDED_PURPOSE.md rule 4). */
export default function Journal() {
  const tasks = useStore((s) => s.tasks);
  const history = useStore((s) => s.history);
  const top = useTop();
  const { doneCount, taskTotal, segs, legend } = useMemo(() => journalStats(history, tasks), [history, tasks]);

  return (
    <Background>
      <View style={{ paddingTop: top + 13, paddingHorizontal: 22, paddingBottom: 14 }}>
        <Kicker>Journal</Kicker>
        <Text style={[T.h1, { fontSize: 36, lineHeight: 40, marginTop: 6 }]}>What you’ve learned</Text>
        <SupportLink style={{ marginTop: 6 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 120, gap: 12 }}>
        <Glass style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ fontFamily: F.serif, fontSize: 52, lineHeight: 54, letterSpacing: -1.5, color: colors.navy }}>{doneCount}</Text>
            <Text style={[T.body, { flex: 1, lineHeight: 22, color: colors.slate }]}>of {taskTotal} done or partly done in {monthName(new Date())}</Text>
          </View>
          <SegBar segs={segs} height={12} />
          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#0f274614' }}>
            {legend.map((l) => (
              <View key={l.k} style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: F.serif, fontSize: 22, lineHeight: 24, color: colors.navy }}>{l.n}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Seg look={l} height={10} radius={3} style={{ width: 10, borderWidth: 1 }} />
                  <Text style={{ fontFamily: F.serif, fontSize: 12, color: colors.slate }}>{l.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </Glass>
        <Glass style={{ paddingVertical: 4, paddingHorizontal: 18 }}>
          {history.length === 0 && <Text style={[T.muted, { paddingVertical: 16 }]}>Your check-ins will appear here.</Text>}
          {history.map((h, i) => (
            <View key={h.id} style={{ gap: 6, paddingVertical: 16, borderBottomWidth: i < history.length - 1 ? 1 : 0, borderBottomColor: '#0f274614' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={[T.small, { color: colors.slateLight }]}>{h.label}</Text>
                <Pill label={OUT[h.outcome].label} bg={OUT[h.outcome].bg} fg={OUT[h.outcome].fg} />
              </View>
              <Text style={{ fontFamily: F.serifMed, fontSize: 16, lineHeight: 21, color: colors.navy }}>{h.title}</Text>
              <Text style={{ fontFamily: F.serifIt, fontSize: 18, lineHeight: 24, color: colors.slate }}>“{learningOf(h)}”</Text>
            </View>
          ))}
        </Glass>
      </ScrollView>
      <TabBar active="journal" />
    </Background>
  );
}
