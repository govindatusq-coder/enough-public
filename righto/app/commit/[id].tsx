import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CheckCircle, CircleIcon as Circle } from 'phosphor-react-native';
import { Background, Glass, NavyCard, Kicker, BackRow, Chip, PrimaryButton, BottomBar, RoutineIcon, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore, useTask } from '../../src/store';
import { useTimePicker } from '../../src/time-picker';
import { type Plan, ROUTINES, NOPREP, uniq, defaultPlan, routineOf } from '../../src/logic';

/** Set a commitment — When · Where · How · Make it easy, with a live navy preview. */
export default function Commit() {
  const { id, daily } = useLocalSearchParams<{ id: string; daily?: string }>();
  const task = useTask(id);
  const [plan, setPlan] = useState<Plan | null>(() => (task ? defaultPlan(task) : null));
  const routineTimes = useStore((s) => s.routineTimes);
  const set = useStore((s) => s.set);
  const picker = useTimePicker();
  if (!task || !plan) return <Background><BackRow /></Background>;

  const willBeDaily = !!daily || (task.status === 'planned' && task.daily);
  const r = routineOf(plan.routine, routineTimes);
  const hasPrep = !!plan.prep && plan.prep !== NOPREP;
  const pills = (opts: string[], key: 'where' | 'how' | 'prep') => uniq([plan[key], ...opts]).map((o) => (
    <Chip key={o} label={o} selected={plan[key] === o} onPress={() => setPlan({ ...plan, [key]: o })} />
  ));

  const sections: { title: string; q: string; body: React.ReactNode }[] = [
    { title: 'When', q: 'Link it to something you already do', body: (
      <Glass style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
        {ROUTINES.map((x0, i) => {
          const x = routineOf(x0.id, routineTimes);
          const on = plan.routine === x.id;
          return (
            <Pressable key={x.id} onPress={() => setPlan({ ...plan, routine: x.id })} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={x.anchor + ', ' + x.name + ' routine, around ' + x.time}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 8, borderBottomWidth: i < ROUTINES.length - 1 ? 1 : 0, borderBottomColor: '#0f274614' }}>
              <View style={{ width: 24 }}><RoutineIcon id={x.id} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 21, color: colors.navy }}>{x.anchor}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Text style={T.small}>{x.name} routine · around {x.time}</Text>
                  <Pressable onPress={() => picker.open(x.time, (t) => set({ routineTimes: { ...routineTimes, [x.id]: t } }))} accessibilityRole="button" accessibilityLabel={'Change the time of your ' + x.name.toLowerCase() + ' routine'} hitSlop={8}>
                    <Text style={[T.small, { color: colors.steel, textDecorationLine: 'underline', textDecorationColor: '#5E7C9680' }]}>Change</Text>
                  </Pressable>
                </View>
              </View>
              {on ? <CheckCircle size={22} weight="fill" color={colors.navy} /> : <Circle size={22} weight="light" color={colors.navy} />}
            </Pressable>
          );
        })}
      </Glass>
    ) },
    { title: 'Where', q: 'Where will you be?', body: <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{pills(task.whereOpts, 'where')}</View> },
    { title: 'How', q: 'What exactly will you do?', body: <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{pills(task.howOpts, 'how')}</View> },
    { title: 'Make it easy', q: 'One thing to set up beforehand', body: <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{pills([...task.prepOpts, NOPREP], 'prep')}</View> },
  ];

  const sand = { color: colors.sand };
  return (
    <Background>
      <BackRow right={<Kicker style={{ paddingRight: 14 }}>When · Where · How</Kicker>} />
      <View style={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 10 }}>
        <NavyCard variant="soft" style={{ paddingVertical: 16 }}>
          <Kicker style={{ color: colors.sand }}>Your plan{willBeDaily ? ' · every day' : ''}</Kicker>
          <Text style={{ fontFamily: F.serif, fontSize: 20, lineHeight: 27, color: colors.cream, marginTop: 6 }}>
            <Text style={sand}>{r.anchor}</Text>, I will <Text style={sand}>{plan.how}</Text>, <Text style={sand}>{plan.where}</Text>.
          </Text>
          {hasPrep && <Text style={{ fontFamily: F.serifIt, fontSize: 15, lineHeight: 21, color: colors.cardOnNavy, marginTop: 6 }}>To make it easier, I’ll {plan.prep}.</Text>}
        </NavyCard>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 18, paddingBottom: 24, gap: 22 }}>
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
        <PrimaryButton label="Next: make your commitment" iconRight={<ArrowRight size={18} weight="light" color={colors.cream} />}
          onPress={() => router.push({ pathname: '/pledge/[id]', params: { id: task.id, routine: plan.routine, how: plan.how, where: plan.where, prep: plan.prep, ...(willBeDaily ? { daily: '1' } : {}) } })} />
      </BottomBar>
      {picker.element}
    </Background>
  );
}
