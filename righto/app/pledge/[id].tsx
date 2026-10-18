import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, HandHeart } from 'phosphor-react-native';
import { Background, NavyCard, Kicker, BackRow, PrimaryButton, BottomBar, CheckRow, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore, useTask } from '../../src/store';
import { type Plan, type RoutineId, NOPREP, sentence, routineOf, dateStamp, CLIENT, PSYCH, cap } from '../../src/logic';
import { scheduleCommitment } from '../../src/notifications';
import { toast } from '../../src/toast';

/** Your commitment — a simple tap seals it; reminders are scheduled locally at the routine time. */
export default function Pledge() {
  const q = useLocalSearchParams<{ id: string; routine: RoutineId; how: string; where: string; prep: string; time?: string; daily?: string }>();
  const task = useTask(q.id);
  const shareDefault = useStore((s) => s.shareDefault);
  const notifDetail = useStore((s) => s.notifDetail);
  const patchTask = useStore((s) => s.patchTask);
  const [share, setShare] = useState(shareDefault);
  if (!task) return <Background><BackRow /></Background>;

  const plan: Plan = { routine: q.routine, how: q.how, where: q.where, prep: q.prep, time: q.time || null };
  const r = routineOf(plan.routine);
  const daily = q.daily === '1';
  const hasPrep = !!plan.prep && plan.prep !== NOPREP;

  const commit = async () => {
    const next = { ...task, status: 'planned' as const, kind: 'commitment' as const, plan, daily, today: null, shared: share };
    patchTask(task.id, { status: 'planned', kind: 'commitment', plan, daily, today: null, shared: share });
    const notifIds = await scheduleCommitment(next, notifDetail);
    patchTask(task.id, { notifIds });
    toast(plan.time ? 'Committed. We’ll nudge you at ' + plan.time + (daily ? ', every day.' : '.') : 'Committed. Added to your ' + r.name.toLowerCase() + ' routine' + (daily ? ', every day.' : ' for next time.'));
    router.dismissTo('/home');
  };

  return (
    <Background>
      <BackRow />
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 16 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Kicker>Commitment</Kicker>
          <Text style={[T.h1, { marginTop: 8 }]}>Make your commitment</Text>
        </View>
        <NavyCard variant="pledge" style={{ gap: 12 }}>
          <Text style={{ fontFamily: F.script, fontSize: 46, lineHeight: 66, color: colors.sand, marginLeft: -6, paddingRight: 6, marginVertical: -4 }}>{'\u00A0'}I commit,</Text>
          <Text style={{ fontFamily: F.serif, fontSize: 23, lineHeight: 30, letterSpacing: -0.3, color: colors.cream }}>{sentence(plan)}</Text>
          {hasPrep && <Text style={{ fontFamily: F.serifIt, fontSize: 16, lineHeight: 23, color: colors.cardOnNavy }}>To make it easier, I’ll {plan.prep}.</Text>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#FBF8F133' }}>
            <Text style={{ fontFamily: F.script, fontSize: 30, lineHeight: 44, color: colors.cream, marginLeft: -4, paddingRight: 6 }}>{'\u00A0' + cap(CLIENT.name)}</Text>
            <Kicker style={{ color: colors.cardOnNavy }}>{dateStamp(new Date())}</Kicker>
          </View>
        </NavyCard>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: 6 }}>
          <Bell size={20} weight="light" color={colors.steel} />
          <Text style={[T.meta, { flex: 1, fontSize: 15, lineHeight: 22 }]}>{plan.time ? 'We’ll nudge you at ' + plan.time + (daily ? ', every day.' : '.') : 'We’ll nudge you around ' + r.time + ', when your ' + r.name.toLowerCase() + ' usually starts' + (daily ? ', every day.' : '.')}</Text>
        </View>
        <CheckRow size={20} on={share} onPress={() => setShare(!share)} label={'Share my commitment with ' + PSYCH.short} />
      </ScrollView>
      <BottomBar style={{ gap: 8 }}>
        <PrimaryButton label="Make this commitment" icon={<HandHeart size={20} weight="light" color={colors.cream} />} onPress={commit} />
      </BottomBar>
    </Background>
  );
}
