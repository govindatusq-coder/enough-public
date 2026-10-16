import { ScrollView, Text, View, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, CalendarDots, ShieldCheck, FilePdf, LinkBreak, HandHeart } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, PrimaryButton, SecondaryButton, SegBar, Seg, Pill, Toggle, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore } from '../../src/store';
import { CLIENT, OUT, LOOK, lineOf, suggestionLine, statusTag, perTaskRows, daysUntil, dLabel, learningOf, dayLabel, PSYCH } from '../../src/logic';
import { toast } from '../../src/toast';

/** Psychologist · Client review. Shows only what the client shared; every view is (to be) logged server-side in Phase 4. */
export default function ClientReview() {
  const { client = CLIENT.name } = useLocalSearchParams<{ client?: string }>();
  const first = client.split(' ')[0];
  const isSam = client === CLIENT.name;
  const allTasks = useStore((s) => s.tasks);
  const allHistory = useStore((s) => s.history);
  const nextSession = useStore((s) => s.nextSession);
  const homePrompt = useStore((s) => s.homePrompt);
  const set = useStore((s) => s.set);

  const tasks = isSam ? allTasks : [];
  const history = isSam ? allHistory.filter((h) => h.shared) : [];
  const done = history.filter((h) => h.outcome !== 'missed').length;
  const segs = [...history].reverse().map((h) => ({ key: h.id, label: h.title + ' · ' + OUT[h.outcome].label, ...LOOK[h.outcome] }));
  const rows = perTaskRows(history, tasks);
  const when = new Date(nextSession.iso);
  const whenLabel = dayLabel(when) + ', ' + when.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

  const exportNotes = async () => {
    const lines = [
      'Righto · homework summary for ' + client + ' · exported ' + dayLabel(new Date()),
      'Prepared by ' + PSYCH.name + ' (' + PSYCH.title + '). Contains only items ' + first + ' chose to share.',
      '',
      ...tasks.map((t) => '• ' + t.title + ' — ' + statusTag(t).label + (t.shared && t.status === 'planned' ? ' — “' + lineOf(t) + '”' : '')),
      '',
      'Check-ins (' + history.length + '):',
      ...history.map((h) => '• ' + h.label + ' · ' + h.title + ' · ' + OUT[h.outcome].label + ' · ' + learningOf(h)),
    ];
    try { await Share.share({ message: lines.join('\n'), title: 'Righto summary · ' + client }); toast('Summary ready to add to your clinical notes.'); } catch { /* cancelled */ }
  };
  const endSharing = () => Alert.alert('End sharing with ' + first + '?', first + ' will be asked to confirm. Sharing stops for new entries; your own clinical record is unaffected.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'End sharing', style: 'destructive', onPress: () => toast(first + ' will be asked to confirm. Sharing stops for new entries.') }]);

  return (
    <Background>
      <BackRow label="Clients" right={<PrimaryButton label="Assign" icon={<Plus size={18} weight="light" color={colors.cream} />} style={{ minHeight: 44, paddingHorizontal: 20, marginRight: 8, shadowOpacity: 0, elevation: 0 }} onPress={() => router.push({ pathname: '/psych/assign', params: { client } })} />} />
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 18, paddingBottom: 24, gap: 12 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Kicker>Homework</Kicker>
          <Text style={[T.h1, { marginTop: 6, marginBottom: 4 }]}>{client}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><CalendarDots size={16} weight="light" color={colors.slate} /><Text style={T.meta}>Next session {whenLabel} · in {dLabel(daysUntil(nextSession.iso, new Date()))}</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}><ShieldCheck size={15} weight="light" color={colors.slateLight} /><Text style={[T.small, { color: colors.slateLight }]}>Your access to this record is logged</Text></View>
        </View>

        <Glass style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Kicker>Homework this month</Kicker>
            <Text style={T.small}>{history.length ? 'Recorded by ' + first : 'No check-ins yet'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ fontFamily: F.serif, fontSize: 46, lineHeight: 48, letterSpacing: -1.5, color: colors.navy }}>{done}</Text>
            <Text style={[T.muted, { flex: 1, lineHeight: 21 }]}>of {history.length} check-ins done or partly done</Text>
          </View>
          {segs.length > 0 && <SegBar segs={segs} height={10} />}
          <View style={{ paddingTop: 4 }}>
            {rows.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40, borderTopWidth: 1, borderTopColor: '#0f274612' }}>
                <Text style={{ flex: 1, fontFamily: F.serif, fontSize: 15, lineHeight: 19, color: colors.navy }}>{p.title}</Text>
                <View style={{ flexDirection: 'row', gap: 4 }} accessible accessibilityLabel={p.dots.map((d) => d.label).join(', ')}>
                  {p.dots.map((d) => <Seg key={d.key} look={d} height={10} style={{ width: 10 }} />)}
                </View>
                <Text style={{ width: 34, textAlign: 'right', fontFamily: F.serif, fontSize: 15, color: colors.navy }}>{p.ratio}</Text>
              </View>
            ))}
          </View>
        </Glass>

        {isSam && (
          <Glass style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 22, color: colors.navy }}>Ask “What feels doable?” on Home</Text>
              <Text style={[T.meta, { lineHeight: 20 }]}>Lets {first} pick a small, quiet or longer task first. Not scored or shared.</Text>
            </View>
            <Toggle on={homePrompt} onChange={(v) => set({ homePrompt: v })} label="Ask what feels doable on Home" />
          </Glass>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SecondaryButton label="Export to notes" size={15} icon={<FilePdf size={18} weight="light" color={colors.navy} />} onPress={exportNotes} style={{ flex: 1, minHeight: 48, paddingHorizontal: 12 }} />
          <SecondaryButton label="End sharing" size={15} icon={<LinkBreak size={18} weight="light" color={colors.slate} />} onPress={endSharing} style={{ flex: 1, minHeight: 48, paddingHorizontal: 12 }} />
        </View>

        {tasks.length === 0 && <Text style={[T.muted, { paddingHorizontal: 4 }]}>No homework yet. Assign something small to start.</Text>}
        {tasks.map((t) => {
          const tag = statusTag(t);
          const last = history.find((h) => h.taskId === t.id);
          const planned = t.status === 'planned';
          const line = planned ? (t.shared ? lineOf(t) : '') : t.suggestion ? 'You suggested: ' + suggestionLine(t.suggestion) : '';
          return (
            <Glass key={t.id} style={{ padding: 18, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={[T.small, { color: colors.slateLight }]}>Sent {t.sent}</Text>
                <Pill label={tag.label} bg={tag.bg} fg={tag.fg} />
              </View>
              <Text style={{ fontFamily: F.serif, fontSize: 23, lineHeight: 26, letterSpacing: -0.4, color: colors.navy }}>{t.title}</Text>
              {line ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <HandHeart size={18} weight="light" color={colors.steel} style={{ marginTop: 2 }} />
                  <Text style={[T.italic, { flex: 1 }]}>“{line}”</Text>
                </View>
              ) : planned ? (
                <Text style={T.meta}>{first} chose not to share the plan.</Text>
              ) : (
                <Text style={T.meta}>Waiting for {first} to choose how to start.</Text>
              )}
              {last && (
                <View style={{ padding: 14, borderRadius: 16, backgroundColor: '#ffffff38', borderWidth: 1, borderColor: '#ffffff9c', gap: 6 }}>
                  <Kicker>Latest learning · {last.label}</Kicker>
                  <Text style={{ fontFamily: F.serif, fontSize: 18, lineHeight: 24, color: colors.navy }}>“{learningOf(last)}”</Text>
                </View>
              )}
            </Glass>
          );
        })}
      </ScrollView>
    </Background>
  );
}
