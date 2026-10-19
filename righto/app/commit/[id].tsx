import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CheckCircle, CircleIcon as Circle } from 'phosphor-react-native';
import { Background, Glass, NavyCard, Kicker, BackRow, Chip, Field, PrimaryButton, BottomBar, RoutineIcon, T, F, MissingTask } from '../../src/ui';
import { colors } from '../../src/theme';
import { useTask } from '../../src/store';
import { TimePill } from '../../src/time-picker';
import { type Plan, ROUTINES, NOPREP, OWN_TIME, uniq, defaultPlan, routineFor } from '../../src/logic';

type TextKey = 'where' | 'how' | 'prep';
const OWN = 'Something else…';
const PLACEHOLDER: Record<TextKey, string> = { where: 'e.g. In the car before I go in', how: 'e.g. Stretch for two minutes', prep: 'e.g. Put my shoes by the door' };

/**
 * Set a commitment — When · Where · How · Make it easy, with a live navy preview.
 * Every section offers the clinician's options and a fourth, the client's own: a routine they already have
 * ("After I feed the dog", at a time they pick), or their own words for where, how and the set-up.
 */
export default function Commit() {
  const { id, daily } = useLocalSearchParams<{ id: string; daily?: string }>();
  const task = useTask(id);
  const [plan, setPlan] = useState<Plan | null>(() => (task ? defaultPlan(task) : null));
  // Which text sections the client is writing themselves. A saved plan whose answer is not one of the options starts as "own".
  const [writing, setWriting] = useState<Record<TextKey, boolean>>(() => initWriting(task));
  useEffect(() => { if (!plan && task) { setPlan(defaultPlan(task)); setWriting(initWriting(task)); } }, [task]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!task || !plan) return <MissingTask />;

  const willBeDaily = !!daily || (task.status === 'planned' && task.daily);
  const ownRoutine = plan.routine === 'own';
  const r = routineFor(plan);
  const ownTime = ownRoutine || !!plan.time;
  const hasPrep = !!plan.prep && plan.prep !== NOPREP;
  const optsFor = (key: TextKey) => (key === 'where' ? task.whereOpts : key === 'how' ? task.howOpts : [...task.prepOpts, NOPREP]);
  const ready = (!ownRoutine || !!(plan.anchor || '').trim()) && !!plan.how.trim() && !!plan.where.trim() && (!writing.prep || !!plan.prep.trim());

  const pickRoutine = (routine: Plan['routine']) =>
    setPlan(routine === 'own' ? { ...plan, routine, anchor: plan.anchor || '', time: plan.time || OWN_TIME } : { ...plan, routine, time: plan.routine === 'own' ? null : plan.time });

  /** The clinician's options as chips, then "Something else…" which opens a field for the client's own words. */
  const choice = (key: TextKey) => {
    const opts = uniq(optsFor(key));
    const own = writing[key];
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {opts.map((o) => <Chip key={o} label={o} selected={!own && plan[key] === o} onPress={() => { setWriting({ ...writing, [key]: false }); setPlan({ ...plan, [key]: o }); }} />)}
          <Chip label={OWN} selected={own} onPress={() => { setWriting({ ...writing, [key]: true }); if (opts.includes(plan[key])) setPlan({ ...plan, [key]: '' }); }} />
        </View>
        {own ? <Field label="" value={plan[key]} onChangeText={(v) => setPlan({ ...plan, [key]: v })} placeholder={PLACEHOLDER[key]} inputProps={{ autoCapitalize: 'none', returnKeyType: 'done', autoFocus: !plan[key] }} /> : null}
      </View>
    );
  };

  const sections: { title: string; q: string; body: React.ReactNode }[] = [
    { title: 'When', q: 'Link it to something you already do', body: (
      <Glass style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
        {ROUTINES.map((x) => {
          const on = plan.routine === x.id;
          return (
            <Pressable key={x.id} onPress={() => pickRoutine(x.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={x.anchor + ', ' + x.name + ' routine, around ' + x.time}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0f274614' }}>
              <View style={{ width: 24 }}><RoutineIcon id={x.id} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 21, color: colors.navy }}>{x.anchor}</Text>
                <Text style={T.small}>{x.name} routine · around {x.time}</Text>
              </View>
              {on ? <CheckCircle size={22} weight="fill" color={colors.navy} /> : <Circle size={22} weight="light" color={colors.navy} />}
            </Pressable>
          );
        })}
        <Pressable onPress={() => pickRoutine('own')} accessibilityRole="radio" accessibilityState={{ checked: ownRoutine }} accessibilityLabel="Something else I already do, at a time I pick"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 8 }}>
          <View style={{ width: 24 }}><RoutineIcon id="own" /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 21, color: colors.navy }}>Something else I already do</Text>
            <Text style={T.small}>Your own routine · at a time you pick</Text>
          </View>
          {ownRoutine ? <CheckCircle size={22} weight="fill" color={colors.navy} /> : <Circle size={22} weight="light" color={colors.navy} />}
        </Pressable>
        {ownRoutine ? (
          <View style={{ paddingBottom: 14 }}>
            <Field label="" value={plan.anchor || ''} onChangeText={(v) => setPlan({ ...plan, anchor: v })} placeholder="e.g. After I feed the dog" inputProps={{ autoCapitalize: 'sentences', returnKeyType: 'done', autoFocus: !plan.anchor }} />
          </View>
        ) : null}
      </Glass>
    ) },
    { title: 'Where', q: 'Where will you be?', body: choice('where') },
    { title: 'How', q: 'What exactly will you do?', body: choice('how') },
    { title: 'Make it easy', q: 'One thing to set up beforehand', body: choice('prep') },
    { title: 'Reminder', q: ownRoutine ? 'When does that usually happen?' : 'When should we nudge you?', body: (
      <Glass style={{ padding: 14, gap: 8 }}>
        {ownRoutine ? null : (
          <Pressable onPress={() => setPlan({ ...plan, time: null })} accessibilityRole="radio" accessibilityState={{ checked: !ownTime }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 50, paddingHorizontal: 16, borderRadius: 40, borderWidth: 1, backgroundColor: ownTime ? '#fbf8f170' : colors.navy, borderColor: ownTime ? '#0F274633' : colors.navy }}>
            <Text style={{ fontFamily: F.serif, fontSize: 16, lineHeight: 20, color: ownTime ? colors.navy : colors.cream, flexShrink: 1 }}>Around {r.time}, with my routine</Text>
            {ownTime ? <Circle size={20} weight="light" color={colors.navy} /> : <CheckCircle size={20} weight="fill" color={colors.cream} />}
          </Pressable>
        )}
        <TimePill label={ownRoutine ? 'Remind me at' : 'At a time I choose'} value={plan.time ?? null} selected={ownTime} onChange={(t) => setPlan({ ...plan, time: t })} />
        {ownRoutine ? <Text style={[T.small, { paddingHorizontal: 4 }]}>We’ll nudge you at {r.time}{willBeDaily ? ', every day' : ''}. Change it any time.</Text> : null}
      </Glass>
    ) },
  ];

  const sand = { color: colors.sand };
  const dots = <Text style={{ color: colors.cardOnNavy }}>…</Text>;
  return (
    <Background>
      <BackRow />
      <View style={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 10 }}>
        <NavyCard variant="soft" style={{ paddingVertical: 16 }}>
          <Kicker style={{ color: colors.sand }}>Your plan{willBeDaily ? ' · every day' : ''}</Kicker>
          <Text style={{ fontFamily: F.serif, fontSize: 20, lineHeight: 27, color: colors.cream, marginTop: 6 }}>
            <Text style={sand}>{r.anchor}</Text>, I will <Text style={sand}>{plan.how.trim() || dots}</Text>, <Text style={sand}>{plan.where.trim() || dots}</Text>.
          </Text>
          {hasPrep && <Text style={{ fontFamily: F.serifIt, fontSize: 15, lineHeight: 21, color: colors.cardOnNavy, marginTop: 6 }}>To make it easier, I’ll {plan.prep}.</Text>}
        </NavyCard>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 18, paddingBottom: 24, gap: 22 }} keyboardShouldPersistTaps="handled">
        {sections.map((sec) => (
          <View key={sec.title} style={{ gap: 10 }}>
            <View style={{ paddingHorizontal: 4 }}>
              <Kicker>{sec.title}</Kicker>
              <Text style={{ fontFamily: F.serif, fontSize: 18, lineHeight: 23, color: colors.navy, marginTop: 4 }}>{sec.q}</Text>
            </View>
            {sec.body}
          </View>
        ))}
      </ScrollView>
      <BottomBar>
        <PrimaryButton label="Next: make your commitment" disabled={!ready} iconRight={<ArrowRight size={18} weight="light" color={colors.cream} />}
          onPress={() => router.push({ pathname: '/pledge/[id]', params: {
            id: task.id, routine: plan.routine, ...(ownRoutine ? { anchor: (plan.anchor || '').trim() } : {}),
            how: plan.how.trim(), where: plan.where.trim(), prep: writing.prep && !plan.prep.trim() ? NOPREP : plan.prep.trim(),
            ...(plan.time ? { time: plan.time } : {}), ...(willBeDaily ? { daily: '1' } : {}),
          } })} />
      </BottomBar>
    </Background>
  );
}

/** A saved or suggested answer that is not one of the clinician's options is the client's own words: open that field. */
function initWriting(task: ReturnType<typeof useTask>): Record<TextKey, boolean> {
  if (!task) return { where: false, how: false, prep: false };
  const p = defaultPlan(task);
  const not = (v: string, opts: string[]) => !!v && !opts.includes(v);
  return { where: not(p.where, task.whereOpts), how: not(p.how, task.howOpts), prep: not(p.prep, [...task.prepOpts, NOPREP]) };
}
