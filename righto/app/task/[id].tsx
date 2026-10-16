import { ScrollView, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarBlank, CaretRight, Play, LinkSimple, Target } from 'phosphor-react-native';
import { Background, Glass, NavyCard, Kicker, BackRow, InfoButtons, IconCircle, TextButton, SupportLink, BottomBar, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore, useTask } from '../../src/store';
import { suggestionLine, plusDays, dayLabel, DAYS, PSYCH, longDayLabel } from '../../src/logic';
import { cancelFor, scheduleNudge } from '../../src/notifications';
import { toast } from '../../src/toast';

/** New task — from an alert or Home. The client chooses how to start; anything suggested is a starting point they can change. */
export default function NewTask() {
  const { id, daily } = useLocalSearchParams<{ id: string; daily?: string }>();
  const task = useTask(id);
  const patchTask = useStore((s) => s.patchTask);
  const notifDetail = useStore((s) => s.notifDetail);
  const nextSession = useStore((s) => s.nextSession);
  if (!task) return <Background><BackRow label="Home" onPress={() => router.dismissTo('/home')} /></Background>;

  const sg = task.suggestion;
  const p = { id: task.id, ...(daily ? { daily } : {}) };
  const opts = [
    { k: 'now', label: 'Do it now', sub: 'About ' + task.mins + ' min. We’ll start a timer.', Icon: Play, go: () => router.push({ pathname: '/now/[id]', params: { id: task.id } }) },
    { k: 'commitment', label: 'Set a commitment', sub: 'Link it to something you already do, like your morning coffee.', Icon: LinkSimple, go: () => router.push({ pathname: '/commit/[id]', params: p }) },
    { k: 'goal', label: 'Set a goal', sub: 'Spell out exactly what, how much and by when, with your own reminder.', Icon: Target, go: () => router.push({ pathname: '/goal/[id]', params: p }) },
  ];

  const nothingNow = async () => {
    const until = plusDays(new Date(), 3);
    patchTask(task.id, { status: 'later', laterUntil: dayLabel(until) });
    await cancelFor(task);
    const notifIds = await scheduleNudge(task, notifDetail);
    patchTask(task.id, { notifIds });
    toast('Okay. We’ll check in again on ' + DAYS[(until.getDay() + 6) % 7] + '.');
    router.dismissTo('/home');
  };

  const sessionDay = longDayLabel(new Date(nextSession.iso)).split(' ')[0];

  return (
    <Background>
      <BackRow label="Home" onPress={() => router.dismissTo('/home')} right={<InfoButtons taskId={task.id} />} />
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 14 }}>
        <View style={{ paddingHorizontal: 4, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.champagne }} />
            <Kicker>From {PSYCH.name} ({PSYCH.title}) · {task.sent}</Kicker>
          </View>
          <Text style={T.h1}>{task.title}</Text>
          <Text style={{ fontFamily: F.serif, fontSize: 15, color: colors.slate }}>About {task.mins} min · {task.needs}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CalendarBlank size={16} weight="light" color={colors.slate} />
            <Text style={[T.italic, { fontSize: 15, lineHeight: 20 }]}>Before {sessionDay}’s session</Text>
          </View>
        </View>

        <Glass style={{ padding: 18, gap: 8 }}>
          <Kicker>What to do</Kicker>
          <Text style={T.body}>{task.detail}</Text>
        </Glass>

        {sg && (
          <NavyCard variant="soft" style={{ paddingVertical: 16, gap: 6 }}>
            <Kicker style={{ color: colors.sand }}>{PSYCH.short} suggests {sg.kind === 'goal' ? 'a goal' : 'a commitment'}</Kicker>
            <Text style={{ fontFamily: F.serif, fontSize: 19, lineHeight: 26, color: colors.cream }}>{suggestionLine(sg)}</Text>
            <Text style={{ fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: colors.cardOnNavy }}>From your session. You can change any of it.</Text>
          </NavyCard>
        )}

        <Text style={{ fontFamily: F.serif, fontSize: 21, lineHeight: 26, color: colors.navy, paddingTop: 4, paddingHorizontal: 6 }}>How would you like to start?</Text>
        <Glass style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
          {opts.map((o, i) => {
            const tag = !!sg && sg.kind === o.k;
            return (
              <Pressable key={o.k} onPress={o.go} accessibilityRole="button" accessibilityLabel={o.label + (tag ? ', suggested' : '') + '. ' + o.sub}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 10, borderBottomWidth: i < opts.length - 1 ? 1 : 0, borderBottomColor: '#0f274614', opacity: pressed ? 0.7 : 1 })}>
                <IconCircle bg={tag ? colors.navy : '#fbf8f1a0'}><o.Icon size={20} weight="light" color={tag ? colors.cream : colors.navy} /></IconCircle>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: F.serif, fontSize: 18, lineHeight: 22, color: colors.navy }}>{o.label}</Text>
                    {tag && <View style={{ paddingVertical: 2, paddingHorizontal: 9, borderRadius: 20, backgroundColor: colors.sand }}><Text style={{ fontFamily: F.serif, fontSize: 12, color: colors.partlyText }}>Suggested</Text></View>}
                  </View>
                  <Text style={[T.meta, { lineHeight: 19 }]}>{o.sub}</Text>
                </View>
                <CaretRight size={16} weight="light" color={colors.navy} />
              </Pressable>
            );
          })}
        </Glass>
      </ScrollView>
      <BottomBar style={{ alignItems: 'center', gap: 2 }}>
        <TextButton label="Nothing for now" color={colors.navy} size={17} weight="medium" onPress={nothingNow} style={{ minHeight: 48, paddingHorizontal: 20 }} />
        <Text style={T.small}>We’ll check in again in a few days.</Text>
        <SupportLink style={{ alignSelf: 'center' }} />
      </BottomBar>
    </Background>
  );
}
