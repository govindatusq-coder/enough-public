import { useState } from 'react';
import { ScrollView, Text, View, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Target, ClockCountdown } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, Field, PrimaryButton, BottomBar, NotMonitored, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore, useTask } from '../../src/store';
import { type Goal, GOALQ, TIMES, DAYS, allDays, daysLine, defaultGoal, PSYCH } from '../../src/logic';
import { scheduleGoal } from '../../src/notifications';
import { TimePill } from '../../src/time-picker';
import { toast } from '../../src/toast';

/** Set a goal — five plain-language questions plus the client's own reminder time and days. */
export default function GoalScreen() {
  const { id, daily } = useLocalSearchParams<{ id: string; daily?: string }>();
  const task = useTask(id);
  const notifDetail = useStore((s) => s.notifDetail);
  const patchTask = useStore((s) => s.patchTask);
  const [g, setG] = useState<Goal | null>(() => {
    if (!task) return null;
    const d = defaultGoal(task);
    if (daily) d.rem.days = allDays();
    return d;
  });
  if (!task || !g) return <Background><BackRow /></Background>;

  const incomplete = GOALQ.some((f) => !(g[f.k] || '').trim()) || !g.rem.days.some(Boolean);
  const suggested = task.suggestion?.kind === 'goal';

  const save = async () => {
    const goal: Goal = { ...g, rem: { ...g.rem, days: [...g.rem.days] } };
    const isDaily = goal.rem.days.every(Boolean);
    patchTask(task.id, { status: 'planned', kind: 'goal', goal, daily: isDaily, today: null });
    const notifIds = await scheduleGoal({ ...task, goal }, notifDetail);
    patchTask(task.id, { notifIds });
    toast('Goal set. We’ll remind you at ' + goal.rem.time + ', ' + daysLine(goal.rem.days) + '.');
    router.dismissTo('/home');
  };

  const sel = (on: boolean) => ({ backgroundColor: on ? colors.navy : '#fbf8f170', borderColor: on ? colors.navy : '#0F274633', color: on ? colors.cream : colors.navy });

  return (
    <Background>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BackRow />
        <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 4 }}>
            <Kicker>Set a goal</Kicker>
            <Text style={[T.h1, { marginVertical: 8 }]}>Make it specific</Text>
            <Text style={T.muted}>{suggested ? PSYCH.short + '’s suggestions from your session are filled in. Change anything that doesn’t fit.' : 'A few words for each is enough.'}</Text>
          </View>
          <Glass style={{ padding: 18, gap: 16 }}>
            {GOALQ.map((f) => <Field key={f.k} label={f.q} placeholder={f.ph} value={g[f.k]} onChangeText={(v) => setG({ ...g, [f.k]: v })} />)}
            <NotMonitored Icon={ClockCountdown} />
          </Glass>
          <Glass style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Kicker>Remind me</Kicker>
              <Text style={T.meta}>{g.rem.time}, {daysLine(g.rem.days)}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TIMES.map((t) => {
                const s = sel(g.rem.time === t);
                return (
                  <Pressable key={t} onPress={() => setG({ ...g, rem: { ...g.rem, time: t } })} accessibilityRole="radio" accessibilityState={{ checked: g.rem.time === t }}
                    style={{ width: '48%', flexGrow: 1, minHeight: 46, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: s.backgroundColor, borderColor: s.borderColor }}>
                    <Text style={{ fontFamily: F.serif, fontSize: 16, color: s.color }}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TimePill label="Or pick your own time" value={TIMES.includes(g.rem.time) ? null : g.rem.time} selected={!TIMES.includes(g.rem.time)} onChange={(t) => setG({ ...g, rem: { ...g.rem, time: t } })} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DAYS.map((d, i) => {
                const s = sel(g.rem.days[i]);
                return (
                  <Pressable key={d} accessibilityRole="checkbox" accessibilityState={{ checked: g.rem.days[i] }} accessibilityLabel={d}
                    onPress={() => { const days = [...g.rem.days]; days[i] = !days[i]; setG({ ...g, rem: { ...g.rem, days } }); }}
                    style={{ flex: 1, aspectRatio: 1, minHeight: 40, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: s.backgroundColor, borderColor: s.borderColor }}>
                    <Text style={{ fontFamily: F.sans, fontSize: 14, color: s.color }}>{d[0]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Glass>
        </ScrollView>
        <BottomBar>
          <PrimaryButton label="Set this goal" icon={<Target size={20} weight="light" color={colors.cream} />} disabled={incomplete} onPress={save} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Background>
  );
}
