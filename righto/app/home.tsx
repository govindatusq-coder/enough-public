import { useCallback, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Play, CalendarBlank, GearSix, Target, CaretLeft } from 'phosphor-react-native';
import { Background, Glass, Kicker, Logo, PrimaryButton, TextButton, SupportLink, TabBar, Field, Chip, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore, useEphemeral } from '../src/store';
import { cap, type Preference, type Task, liveTasks, orderedTasks, pickByPreference, prefKicker, subOf, greeting, currentRoutine, longDayLabel, hasSession, mkTask, MINS, DAYS, CLIENT, PSYCH } from '../src/logic';

const PICKS: { k: Preference; label: string }[] = [
  { k: 'tiny', label: 'Something quick' },
  { k: 'quiet', label: 'Something quiet' },
  { k: 'next', label: 'Whatever’s next' },
  { k: 'time', label: 'I’ve got time' },
];

/** Every task opens on the task screen (Do it now / Do it later / Something else), whatever its state. */
const openTask = (t: Task) => router.push({ pathname: '/task/[id]', params: { id: t.id } });

/** Home — "mindful" variant from the v3 reference. The picker is a sort over clinician tasks; nothing is scored or stored. */
export default function Home() {
  const tasks = useStore((s) => s.tasks);
  const role = useStore((s) => s.role);
  const linked = useStore((s) => s.linked);
  const homePrompt = useStore((s) => s.homePrompt);
  const nextSession = useStore((s) => s.nextSession);
  const { pref, skipped, setPref, skip } = useEphemeral();
  // After a pick, the client can set aside the psychologist's task and name their own small thing instead.
  const [ownMode, setOwnMode] = useState(false);
  const pick = useCallback((p: Preference | null) => { setOwnMode(false); setPref(p); }, [setPref]);
  const top = useTop();
  const now = new Date();
  const scroll = useRef<ScrollView>(null);
  const restart = () => { pick(null); scroll.current?.scrollTo({ y: 0, animated: true }); };
  // Every time the user lands on Home the pick resets, so the "What feels doable right now?" card shows first.
  useFocusEffect(useCallback(() => { pick(null); if (role === 'psych') router.replace('/psych'); }, [pick, role]));

  const live = useMemo(() => liveTasks(tasks), [tasks]);
  const ordered = useMemo(() => orderedTasks(tasks, skipped, currentRoutine(now.getHours())), [tasks, skipped]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextT = ordered[0];
  const effPref: Preference | null = homePrompt ? pref : pref || 'skip';
  const stepT = effPref ? (effPref === 'skip' || effPref === 'next' ? nextT : pickByPreference(tasks, effPref, nextT)) : undefined;
  const newTasks = tasks.filter((t) => t.status === 'new');
  const showNewNote = newTasks.length > 0 && !(stepT && stepT.status === 'new');
  // Home always asks what feels doable. Every pick offers the psychologist's task and the client's own idea; when no task
  // fits (nothing assigned, or everything done today) the pick leads straight to their own idea instead of a rest screen.
  const showOwn = !!effPref && (!stepT || ownMode);
  const calmLine = homePrompt && !pref ? 'Take a breath. There’s nothing you need to do this second.' : 'Take a breath. One small step is enough today.';
  const noneToPick = !live.length;

  return (
    <Background>
      <View style={{ paddingTop: top + 11, paddingHorizontal: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={restart} accessibilityRole="button" accessibilityLabel="Righto. Back to the start of Home" hitSlop={8}><Logo size={30} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fbf8f1a0', borderWidth: 1, borderColor: '#0F274633', alignItems: 'center', justifyContent: 'center' }}><GearSix size={20} weight="light" color={colors.navy} /></View>
          </Pressable>
          <Text style={{ fontFamily: F.serif, fontSize: 15, color: colors.slate, marginLeft: 4 }}>{DAYS[(now.getDay() + 6) % 7]}</Text>
        </View>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1, paddingTop: 36, paddingHorizontal: 26, paddingBottom: 120, gap: 30 }}>
        <View>
          <Text style={T.h2}>{greeting(now.getHours())}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: F.script, fontSize: 66, lineHeight: 100, color: colors.navy, marginLeft: -8, paddingRight: 24, paddingTop: 4, paddingBottom: 16, marginVertical: -10 }}>{'\u00A0' + cap(CLIENT.first)}.</Text>
          <Text style={[T.italic, { fontSize: 17, lineHeight: 25, marginTop: 16 }]}>{calmLine}</Text>
          {hasSession(nextSession.iso) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <CalendarBlank size={17} weight="light" color={colors.slate} />
              <Text style={{ fontFamily: F.serif, fontSize: 15, color: colors.slate }}>Your next session is {longDayLabel(new Date(nextSession.iso))}.</Text>
            </View>
          )}
        </View>

        <View style={{ gap: 18 }}>
          {homePrompt && !pref && (
            <Glass radius={26} style={{ padding: 24, gap: 16 }}>
              <View>
                <Text style={T.title}>What feels doable right now?</Text>
                <Text style={[T.meta, { marginTop: 4 }]}>{noneToPick ? 'Say what feels right and we’ll set something small up together.' : linked ? 'Picks from the tasks ' + PSYCH.short + ' gave you, or something else.' : 'Picks from your tasks, or something else.'}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {PICKS.map(({ k, label }) => <PickTile key={k} label={label} onPress={() => pick(k)} />)}
              </View>
              <TextButton label="Just show me what’s next" italic size={15} onPress={() => pick('skip')} style={{ alignSelf: 'stretch', justifyContent: 'flex-start', paddingHorizontal: 0, minHeight: 36 }} textStyle={{ flexGrow: 1 }} />
            </Glass>
          )}

          {effPref && stepT && !ownMode && (
            <Glass radius={26} style={{ paddingTop: 16, paddingHorizontal: 24, paddingBottom: 22, gap: 12 }}>
              {homePrompt ? <BackLink onPress={() => pick(null)} /> : null}
              {pref ? <Kicker>{prefKicker(pref)}</Kicker> : null}
              <Text style={[T.h2, { lineHeight: 32 }]}>{stepT.title}</Text>
              <Text style={T.italic}>{subOf(stepT)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <PrimaryButton style={{ flex: 1, minHeight: 52, paddingHorizontal: 10, shadowOpacity: 0, elevation: 0 }} icon={<Play size={18} weight="light" color={colors.cream} />}
                  label="Have a look" onPress={() => openTask(stepT)} />
                {live.length > 1 ? <TextButton label="Something else" onPress={() => skip(stepT.id, live.map((x) => x.id))} style={{ minHeight: 52, paddingHorizontal: 12 }} /> : null}
              </View>
              <TextButton label="Or set up something of your own" italic size={15} onPress={() => setOwnMode(true)} style={{ alignSelf: 'stretch', justifyContent: 'flex-start', paddingHorizontal: 0, minHeight: 36, marginTop: -2 }} textStyle={{ flexGrow: 1 }} />
            </Glass>
          )}

          {showOwn && <OwnTaskCard pref={pref} linked={linked} allDone={!stepT && tasks.length > 0} hasPick={!!stepT} onBack={stepT ? () => setOwnMode(false) : homePrompt ? () => pick(null) : undefined} />}

          {showNewNote && (
            <Pressable onPress={() => openTask(newTasks[0])} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4, minHeight: 44 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.champagne, marginTop: 9 }} />
              <Text style={[T.muted, { flex: 1 }]}>{PSYCH.short} sent you something new. <Text style={{ color: colors.navy, textDecorationLine: 'underline', textDecorationColor: '#0F274640' }}>Have a look when you’re ready.</Text></Text>
            </Pressable>
          )}

        </View>

        <SupportLink style={{ marginTop: 'auto', paddingHorizontal: 0 }} />
      </ScrollView>
      <TabBar active="home" />
    </Background>
  );
}

/**
 * No homework yet (or all done): the client names one small thing they would like to try. It becomes their own task,
 * so the usual Do it now / commitment / goal steps apply. Nothing here is advice, scored, or shown to the psychologist.
 */
function OwnTaskCard({ pref, linked, allDone, hasPick, onBack }: { pref: Preference | null; linked: boolean; allDone: boolean; hasPick: boolean; onBack?: () => void }) {
  const addTask = useStore((s) => s.addTask);
  const [title, setTitle] = useState('');
  const [mins, setMins] = useState(pref === 'tiny' ? 5 : pref === 'time' ? 20 : 10);
  const go = () => {
    const t = mkTask({
      id: Crypto.randomUUID(), title: title.trim(), detail: title.trim(), mins, author: 'client', sent: 'Today', status: 'new', tags: pref === 'quiet' ? ['quiet'] : [],
      why: 'Something you chose to try. Keeping it small makes it more likely to happen, and your psychologist can build on it with you next session.',
    });
    addTask(t);
    router.push({ pathname: '/task/[id]', params: { id: t.id } });
  };
  return (
    <Glass radius={26} style={{ paddingTop: onBack ? 16 : 26, paddingHorizontal: 24, paddingBottom: 22, gap: 14 }}>
      {onBack ? <BackLink onPress={onBack} /> : null}
      <Kicker>{pref ? prefKicker(pref) : 'Your own idea'}</Kicker>
      <Text style={[T.h2, { lineHeight: 32 }]}>What’s one small thing you’d like to try?</Text>
      <Text style={T.italic}>{hasPick ? '' : allDone ? 'Everything on your list is done today. ' : linked ? 'Nothing from ' + PSYCH.short + ' yet. ' : ''}Your own ideas count. Keep it small enough to actually happen.</Text>
      <Field label="" value={title} onChangeText={setTitle} placeholder="e.g. A short walk after lunch" inputProps={{ autoCapitalize: 'sentences', returnKeyType: 'done' }} />
      <View style={{ gap: 8 }}>
        <Text style={T.meta}>Takes about</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MINS.map((m) => <Chip key={m} label={m + ' min'} selected={mins === m} onPress={() => setMins(m)} style={{ borderRadius: 40, paddingVertical: 0 }} />)}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <PrimaryButton style={{ flex: 1, minHeight: 52, paddingHorizontal: 10, shadowOpacity: 0, elevation: 0 }} icon={<Target size={18} weight="light" color={colors.cream} />} label="Set it up" disabled={!title.trim()} onPress={go} />
      </View>
    </Glass>
  );
}

/**
 * One of the four picks: a navy-tinted glass tile with a hairline navy border and the label alone, centred, with the
 * full tile width so a word never breaks. Pressing inverts it to solid navy with cream text.
 */
function PickTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({
        width: '47%', flexGrow: 1, minHeight: 62, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 12,
        backgroundColor: pressed ? colors.navy : '#0F274614', borderColor: pressed ? colors.navy : '#0F274640',
        shadowColor: colors.navy, shadowOpacity: pressed ? 0 : 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 0,
      })}>
      {({ pressed }) => <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 22, textAlign: 'center', color: pressed ? colors.cream : colors.navy }}>{label}</Text>}
    </Pressable>
  );
}

/** "‹ Back to the four options" at the top of a card that followed a pick. */
function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Back to the four options" hitSlop={8}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 36, marginLeft: -6, paddingHorizontal: 6, borderRadius: 20, backgroundColor: pressed ? '#fbf8f160' : 'transparent' })}>
      <CaretLeft size={16} weight="light" color={colors.slate} />
      <Text style={{ fontFamily: F.serif, fontSize: 15, color: colors.slate }}>Back</Text>
    </Pressable>
  );
}
