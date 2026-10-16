import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, AccessibilityInfo } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { Check, Play, Pause } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, InfoButtons, PrimaryButton, SecondaryButton, TextButton, SupportLink, BottomBar, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useTask } from '../../src/store';
import { fmt, trim, lc } from '../../src/logic';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 150, STROKE = 6, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const progress = useSharedValue(pct);
  useEffect(() => { progress.value = withTiming(pct, { duration: 1000, easing: Easing.linear }); }, [pct, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.value) }));
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={label + ' ' + sub}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="#0f27461a" strokeWidth={STROKE} fill="none" />
        <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.navy} strokeWidth={STROKE} fill="none" strokeDasharray={`${C} ${C}`} animatedProps={props} />
      </Svg>
      <View style={{ position: 'absolute', top: STROKE, left: STROKE, right: STROKE, bottom: STROKE, borderRadius: SIZE / 2, backgroundColor: '#f6efe4', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Text style={{ fontFamily: F.serif, fontSize: 40, lineHeight: 44, color: colors.navy, fontVariant: ['tabular-nums'] }}>{label}</Text>
        <Text style={T.small}>{sub}</Text>
      </View>
    </View>
  );
}

/** Do it now — a neutral timer. "I've done it" leads to the check-in. */
export default function Now() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  const total = (task?.mins || 1) * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const l = Math.max(0, Math.round(((endAt.current || 0) - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) { setRunning(false); AccessibilityInfo.announceForAccessibility('Time’s up'); }
    };
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [running]);

  if (!task) return <Background><BackRow /></Background>;

  const toggle = () => {
    if (running) { setRunning(false); return; }
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
  };
  const hasPlan = task.status === 'planned';
  const isGoal = task.kind === 'goal';
  const nowText = hasPlan ? (isGoal ? trim(task.goal?.s) + '. You’ll know it’s done when ' + lc(trim(task.goal?.m)) + '.' : 'I will ' + task.plan?.how + ', ' + task.plan?.where + '.') : task.detail;
  const isNew = task.status === 'new' || task.status === 'later';
  const sub = left === 0 ? 'Time’s up' : running ? 'remaining' : left === total ? 'ready when you are' : 'paused';

  return (
    <Background>
      <BackRow right={<InfoButtons taskId={task.id} />} />
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 16 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Kicker>Doing it now · about {task.mins} min</Kicker>
          <Text style={[T.h1, { fontSize: 32, lineHeight: 35, marginTop: 8 }]}>{task.title}</Text>
        </View>
        <Glass style={{ alignItems: 'center', gap: 14, paddingVertical: 24, paddingHorizontal: 18 }}>
          <Ring pct={1 - left / total} label={fmt(left)} sub={sub} />
          <SecondaryButton size={16} style={{ minHeight: 44, alignSelf: 'center' }} onPress={toggle}
            icon={running ? <Pause size={18} weight="light" color={colors.navy} /> : <Play size={18} weight="light" color={colors.navy} />}
            label={running ? 'Pause' : left < total ? 'Resume' : 'Start timer'} />
        </Glass>
        <View style={{ gap: 6, paddingHorizontal: 6 }}>
          <Kicker>What to do</Kicker>
          <Text style={T.body}>{nowText}</Text>
        </View>
        <SupportLink />
      </ScrollView>
      <BottomBar>
        <PrimaryButton label="I’ve done it" icon={<Check size={20} weight="light" color={colors.cream} />} onPress={() => router.push({ pathname: '/checkin/[id]', params: { id: task.id, outcome: 'done' } })} />
        <TextButton label={isNew ? 'Not now, see other options' : 'Not right now'} onPress={() => (isNew ? (router.canGoBack() ? router.back() : router.replace({ pathname: '/task/[id]', params: { id: task.id } })) : router.dismissTo('/home'))} />
      </BottomBar>
    </Background>
  );
}
