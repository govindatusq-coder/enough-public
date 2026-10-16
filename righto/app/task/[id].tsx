import { useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { CalendarBlank, CaretRight, CaretDown, CaretUp, Play, CalendarPlus, Shuffle, LinkSimple, Target, type IconProps } from 'phosphor-react-native';
import { Background, Glass, NavyCard, Kicker, BackRow, InfoButtons, IconCircle, SupportLink, BottomBar, TextButton, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore, useTask } from '../../src/store';
import { suggestionLine, plusDays, dayLabel, DAYS, PSYCH, longDayLabel } from '../../src/logic';
import { cancelFor, scheduleNudge } from '../../src/notifications';
import { toast } from '../../src/toast';

const SuggestedPill = () => (
  <View style={{ paddingVertical: 2, paddingHorizontal: 9, borderRadius: 20, backgroundColor: colors.sand }}>
    <Text style={{ fontFamily: F.serif, fontSize: 12, color: colors.partlyText }}>Suggested</Text>
  </View>
);

/** New task — from an alert or Home. Do it now, do it later (with a routine or at a chosen time), or set it aside. */
export default function NewTask() {
  const { id, daily, later } = useLocalSearchParams<{ id: string; daily?: string; later?: string }>();
  const task = useTask(id);
  const patchTask = useStore((s) => s.patchTask);
  const notifDetail = useStore((s) => s.notifDetail);
  const nextSession = useStore((s) => s.nextSession);
  const [open, setOpen] = useState(later === '1'); // closed whenever the screen opens, unless opened with later=1
  const scroll = useRef<ScrollView>(null);
  const toggleLater = () => setOpen((o) => { if (!o) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); return !o; });
  const closeLater = () => { setOpen(false); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); };
  if (!task) return <Background><BackRow label="Home" onPress={() => router.dismissTo('/home')} /></Background>;

  const sg = task.suggestion;
  const p = { id: task.id, ...(daily ? { daily } : {}) };

  const somethingElse = async () => {
    const until = plusDays(new Date(), 3);
    patchTask(task.id, { status: 'later', laterUntil: dayLabel(until) });
    await cancelFor(task);
    const notifIds = await scheduleNudge(task, notifDetail);
    patchTask(task.id, { notifIds });
    toast('Set aside. We’ll check in again on ' + DAYS[(until.getDay() + 6) % 7] + '.');
    router.dismissTo('/home');
  };

  const opts: { k: string; label: string; sub: string; Icon: React.ComponentType<IconProps>; tag: boolean; go: () => void }[] = [
    { k: 'now', label: 'Do it now', sub: 'About ' + task.mins + ' min. We’ll start a timer.', Icon: Play, tag: false, go: () => router.push({ pathname: '/now/[id]', params: { id: task.id } }) },
    { k: 'later', label: 'Do it later', sub: 'Choose when, and we’ll remind you.', Icon: CalendarPlus, tag: !!sg, go: toggleLater },
    { k: 'else', label: 'Something else', sub: 'Set this one aside for now and see what else there is.', Icon: Shuffle, tag: false, go: somethingElse },
  ];
  const laterOpts = [
    { k: 'commitment', label: 'With something I already do', sub: 'Like after lunch or while my coffee brews.', Icon: LinkSimple, go: () => router.push({ pathname: '/commit/[id]', params: p }) },
    { k: 'goal', label: 'At a time I choose', sub: 'Say what you’ll do and when, and pick your reminder.', Icon: Target, go: () => router.push({ pathname: '/goal/[id]', params: p }) },
  ];

  const sessionDay = longDayLabel(new Date(nextSession.iso)).split(' ')[0];

  return (
    <Background>
      <BackRow label="Home" onPress={() => router.dismissTo('/home')} right={<InfoButtons taskId={task.id} />} />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 14 }}>
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

        <Text style={{ fontFamily: F.serif, fontSize: 21, lineHeight: 26, color: colors.navy, paddingTop: 4, paddingHorizontal: 6 }}>How would you like to do it?</Text>
        <Animated.View layout={LinearTransition.duration(200)} style={{ gap: 14 }}>
          <Glass style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
            {opts.map((o, i) => {
              const Caret = o.k === 'later' ? (open ? CaretUp : CaretDown) : CaretRight;
              return (
                <Pressable key={o.k} onPress={o.go} accessibilityRole="button" accessibilityState={o.k === 'later' ? { expanded: open } : undefined}
                  accessibilityLabel={o.label + (o.tag ? ', suggested' : '') + '. ' + o.sub}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 10, borderBottomWidth: i < opts.length - 1 ? 1 : 0, borderBottomColor: '#0f274614', opacity: pressed ? 0.7 : 1 })}>
                  <IconCircle bg={o.tag ? colors.navy : '#fbf8f1a0'}><o.Icon size={20} weight="light" color={o.tag ? colors.cream : colors.navy} /></IconCircle>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: F.serif, fontSize: 18, lineHeight: 22, color: colors.navy }}>{o.label}</Text>
                      {o.tag && <SuggestedPill />}
                    </View>
                    <Text style={[T.meta, { lineHeight: 19 }]}>{o.sub}</Text>
                  </View>
                  <Caret size={16} weight="light" color={colors.navy} />
                </Pressable>
              );
            })}
          </Glass>

          {open && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
              <Glass style={{ paddingTop: 14, paddingHorizontal: 14, paddingBottom: 4, gap: 4 }}>
                <Kicker style={{ paddingHorizontal: 2 }}>When will you do it?</Kicker>
                {laterOpts.map((o, i) => {
                  const tag = sg?.kind === o.k;
                  return (
                    <Pressable key={o.k} onPress={o.go} accessibilityRole="button" accessibilityLabel={o.label + (tag ? ', suggested' : '') + '. ' + o.sub}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, borderBottomWidth: i < laterOpts.length - 1 ? 1 : 0, borderBottomColor: '#0f274614', opacity: pressed ? 0.7 : 1 })}>
                      <View style={{ width: 24 }}><o.Icon size={22} weight="light" color={colors.steel} /></View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 21, color: colors.navy }}>{o.label}</Text>
                          {tag && <SuggestedPill />}
                        </View>
                        <Text style={T.small}>{o.sub}</Text>
                      </View>
                      <CaretRight size={16} weight="light" color={colors.navy} />
                    </Pressable>
                  );
                })}
                <TextButton label="Back to the other options" icon={<CaretUp size={14} weight="light" color={colors.slate} />} size={15} onPress={closeLater} style={{ alignSelf: 'flex-start', paddingHorizontal: 2, minHeight: 44 }} />
              </Glass>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
      <BottomBar style={{ alignItems: 'center', gap: 2 }}>
        <SupportLink style={{ alignSelf: 'center' }} />
      </BottomBar>
    </Background>
  );
}
