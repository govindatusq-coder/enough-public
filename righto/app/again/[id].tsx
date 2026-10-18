import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SunHorizon, ArrowClockwise, Pause } from 'phosphor-react-native';
import { Background, NavyCard, Kicker, PrimaryButton, SecondaryButton, TextButton, BottomBar, HomeLogo, T, F, useTop } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore, useTask } from '../../src/store';
import { type Outcome, lineOf, routineOf, allDays } from '../../src/logic';
import { cancelFor, scheduleCommitment, scheduleGoal } from '../../src/notifications';
import { toast } from '../../src/toast';

/** Keep it going — after a check-in: make it daily, repeat once more, or set it aside. */
export default function Again() {
  const { id, outcome } = useLocalSearchParams<{ id: string; outcome?: Outcome }>();
  const task = useTask(id);
  const patchTask = useStore((s) => s.patchTask);
  const notifDetail = useStore((s) => s.notifDetail);
  const top = useTop();
  if (!task) return <Background />;

  const hasPlan = task.status === 'planned';
  const isGoal = task.kind === 'goal';
  const rName = hasPlan && !isGoal ? routineOf(task.plan?.routine).name.toLowerCase() : '';
  const wasDone = (outcome ?? task.today) === 'done';
  const home = () => router.dismissTo('/home');

  const makeDaily = async () => {
    if (!hasPlan) return router.push({ pathname: '/task/[id]', params: { id: task.id, daily: '1' } });
    if (isGoal && task.goal) {
      const goal = { ...task.goal, rem: { ...task.goal.rem, days: allDays() } };
      patchTask(task.id, { daily: true, goal });
      patchTask(task.id, { notifIds: await scheduleGoal({ ...task, goal }, notifDetail) });
      toast('We’ll remind you every day at ' + task.goal.rem.time + '.');
    } else {
      patchTask(task.id, { daily: true });
      patchTask(task.id, { notifIds: await scheduleCommitment({ ...task, daily: true }, notifDetail) });
      toast('Now part of your ' + rName + ' routine, every day.');
    }
    home();
  };
  const repeatOnce = async () => {
    if (!hasPlan) return router.push({ pathname: '/task/[id]', params: { id: task.id } });
    if (!isGoal) {
      patchTask(task.id, { daily: false });
      patchTask(task.id, { notifIds: await scheduleCommitment({ ...task, daily: false }, notifDetail) });
    }
    toast(isGoal ? 'Righto. We’ll remind you next time.' : 'Righto. It’s in your ' + rName + ' routine for next time.');
    home();
  };
  const notNow = async () => {
    await cancelFor(task);
    patchTask(task.id, { status: 'finished', notifIds: [] });
    toast('Saved to your journal.');
    home();
  };

  return (
    <Background>
      <View style={{ paddingTop: top + 5, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ width: 60 }} />
        <HomeLogo />
        <TextButton label="Skip" color={colors.navy} onPress={home} style={{ paddingHorizontal: 12 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 16 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Kicker>Check-in saved</Kicker>
          <Text style={{ fontFamily: F.script, fontSize: 50, lineHeight: 72, color: colors.navy, marginTop: 4, marginLeft: -8, paddingLeft: 8, paddingRight: 6 }}>{wasDone ? 'Nice work.' : 'That’s okay.'}</Text>
          <Text style={[T.h1, { fontSize: 32, lineHeight: 35, marginTop: 4, marginBottom: 8 }]}>{wasDone ? 'Want to keep it going?' : 'Want to try it again?'}</Text>
          <Text style={T.muted}>{hasPlan ? (isGoal ? 'You can repeat it once more, or get a reminder every day so it becomes part of your routine.' : 'You can repeat it once more, or make it part of your ' + rName + ' routine so it happens every day.') : 'You can repeat it once more, or make it part of a daily routine. We’ll help you set it up.'}</Text>
        </View>
        {hasPlan && (
          <NavyCard variant="soft" style={{ paddingVertical: 16 }}>
            <Kicker style={{ color: colors.sand }}>{isGoal ? 'Your goal' : 'Your commitment'}</Kicker>
            <Text style={{ fontFamily: F.serif, fontSize: 19, lineHeight: 26, color: colors.cream, marginTop: 6 }}>{lineOf(task)}</Text>
          </NavyCard>
        )}
      </ScrollView>
      <BottomBar style={{ gap: 10 }}>
        <PrimaryButton label={hasPlan && task.daily ? 'Keep it as part of my day' : 'Make it part of my daily routine'} icon={<SunHorizon size={20} weight="light" color={colors.cream} />} onPress={makeDaily} />
        <SecondaryButton label="Repeat it once more" icon={<ArrowClockwise size={20} weight="light" color={colors.navy} />} onPress={repeatOnce} style={{ minHeight: 54 }} />
        <TextButton label="Not for now" icon={<Pause size={18} weight="light" color={colors.slate} />} onPress={notNow} style={{ minHeight: 54 }} />
      </BottomBar>
    </Background>
  );
}
