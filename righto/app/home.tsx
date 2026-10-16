import { useMemo } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Feather, Wind, ArrowRight, Clock, Play, CalendarBlank, GearSix, HourglassMedium } from 'phosphor-react-native';
import { Background, Glass, Kicker, Logo, PrimaryButton, TextButton, SupportLink, TabBar, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore, useEphemeral } from '../src/store';
import { type Preference, type Task, liveTasks, orderedTasks, pickByPreference, PREF_KICKER, subOf, greeting, currentRoutine, longDayLabel, DAYS, CLIENT, PSYCH } from '../src/logic';

const PICKS: { k: Preference; label: string; Icon: typeof Feather }[] = [
  { k: 'tiny', label: 'Something quick', Icon: Feather },
  { k: 'quiet', label: 'Something quiet', Icon: Wind },
  { k: 'next', label: 'Whatever’s next', Icon: ArrowRight },
  { k: 'time', label: 'I’ve got time', Icon: Clock },
];

const openTask = (t: Task) => router.push(t.status === 'new' || t.status === 'later' ? { pathname: '/task/[id]', params: { id: t.id } } : { pathname: '/now/[id]', params: { id: t.id } });

/** Home — "mindful" variant from the v3 reference. The picker is a sort over clinician tasks; nothing is scored or stored. */
export default function Home() {
  const tasks = useStore((s) => s.tasks);
  const homePrompt = useStore((s) => s.homePrompt);
  const nextSession = useStore((s) => s.nextSession);
  const { pref, skipped, setPref, skip } = useEphemeral();
  const top = useTop();
  const now = new Date();

  const live = useMemo(() => liveTasks(tasks), [tasks]);
  const ordered = useMemo(() => orderedTasks(tasks, skipped, currentRoutine(now.getHours())), [tasks, skipped]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextT = ordered[0];
  const effPref: Preference | null = homePrompt ? pref : pref || 'skip';
  const stepT = effPref ? (effPref === 'skip' || effPref === 'next' ? nextT : pickByPreference(tasks, effPref, nextT)) : undefined;
  const newTasks = tasks.filter((t) => t.status === 'new');
  const laterTasks = tasks.filter((t) => t.status === 'later');
  const showNewNote = newTasks.length > 0 && !(stepT && stepT.status === 'new');
  const allDone = !live.length;
  const calmLine = homePrompt && !pref ? 'Take a breath. There’s nothing you need to do this second.' : 'Take a breath. One small step is enough today.';

  return (
    <Background>
      <View style={{ paddingTop: top + 11, paddingHorizontal: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={30} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: F.serif, fontSize: 15, color: colors.slate }}>{DAYS[(now.getDay() + 6) % 7]}</Text>
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 }}>
            <GearSix size={20} weight="light" color={colors.slate} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 36, paddingHorizontal: 26, paddingBottom: 120, gap: 30 }}>
        <View>
          <Text style={T.h2}>{greeting(now.getHours())}</Text>
          <Text style={{ fontFamily: F.script, fontSize: 66, lineHeight: 76, color: colors.navy, marginLeft: -2 }}>{CLIENT.first}.</Text>
          <Text style={[T.italic, { fontSize: 17, lineHeight: 25, marginTop: 16 }]}>{calmLine}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <CalendarBlank size={17} weight="light" color={colors.slate} />
            <Text style={{ fontFamily: F.serif, fontSize: 15, color: colors.slate }}>Your next session is {longDayLabel(new Date(nextSession.iso))}.</Text>
          </View>
        </View>

        <View style={{ gap: 18 }}>
          {!allDone && homePrompt && !pref && (
            <Glass radius={26} style={{ padding: 24, gap: 16 }}>
              <View>
                <Text style={T.title}>What feels doable right now?</Text>
                <Text style={[T.meta, { marginTop: 4 }]}>Picks from the tasks {PSYCH.short} gave you.</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PICKS.map(({ k, label, Icon }) => (
                  <Pressable key={k} onPress={() => setPref(k)} accessibilityRole="button"
                    style={({ pressed }) => ({ width: '48%', flexGrow: 1, minHeight: 60, borderRadius: 20, borderWidth: 1, borderColor: '#ffffffa8', backgroundColor: pressed ? '#fbf8f1a0' : '#fbf8f150', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 })}>
                    <Icon size={24} weight="light" color={colors.steel} />
                    <Text style={{ fontFamily: F.serif, fontSize: 15, lineHeight: 19, color: colors.navy, flex: 1 }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextButton label="Just show me what’s next" italic size={15} onPress={() => setPref('skip')} style={{ alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 36 }} />
            </Glass>
          )}

          {!allDone && effPref && stepT && (
            <Glass radius={26} style={{ paddingTop: 26, paddingHorizontal: 24, paddingBottom: 22, gap: 12 }}>
              <Kicker>{pref ? PREF_KICKER[pref] : PREF_KICKER.skip}</Kicker>
              <Text style={[T.h2, { lineHeight: 32 }]}>{stepT.title}</Text>
              <Text style={T.italic}>{subOf(stepT)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <PrimaryButton style={{ flex: 1, minHeight: 52, shadowOpacity: 0, elevation: 0 }} icon={<Play size={18} weight="light" color={colors.cream} />}
                  label={stepT.status === 'new' ? 'Have a look' : 'Start'} onPress={() => openTask(stepT)} />
                <TextButton label="Something else" onPress={() => (homePrompt ? setPref(null) : skip(stepT.id, live.map((x) => x.id)))} style={{ minHeight: 52, paddingHorizontal: 18 }} />
              </View>
            </Glass>
          )}

          {allDone && (
            <View style={{ gap: 8, paddingVertical: 12 }}>
              <Text style={{ fontFamily: F.script, fontSize: 46, lineHeight: 50, color: colors.navy }}>You’ve done enough for today.</Text>
              <Text style={T.muted}>Rest, or look back over your journal.</Text>
            </View>
          )}

          {showNewNote && (
            <Pressable onPress={() => openTask(newTasks[0])} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4, minHeight: 44 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.champagne, marginTop: 9 }} />
              <Text style={[T.muted, { flex: 1 }]}>{PSYCH.short} sent you something new. <Text style={{ color: colors.navy, textDecorationLine: 'underline', textDecorationColor: '#0F274640' }}>Have a look when you’re ready.</Text></Text>
            </Pressable>
          )}

          {laterTasks.map((t) => (
            <Pressable key={t.id} onPress={() => openTask(t)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4, minHeight: 44 }}>
              <HourglassMedium size={16} weight="light" color={colors.steel} style={{ marginTop: 4 }} />
              <Text style={[T.muted, { flex: 1 }]}>Set aside for later: {t.title}. <Text style={{ color: colors.navy, textDecorationLine: 'underline', textDecorationColor: '#0F274640' }}>Have another look.</Text></Text>
            </Pressable>
          ))}
        </View>

        <SupportLink style={{ marginTop: 'auto', paddingHorizontal: 0 }} />
      </ScrollView>
      <TabBar active="home" />
    </Background>
  );
}
