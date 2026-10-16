import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { SlideInDown, FadeIn } from 'react-native-reanimated';
import { SheetFrame, T } from '../src/ui';
import { useTask } from '../src/store';
import { PSYCH } from '../src/logic';

/** "?" → Why Dr Chen suggested this (clinician's own words). "i" → About this task. Nothing here is generated. */
export default function Sheet() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: 'why' | 'info' }>();
  const task = useTask(id);
  const close = () => router.back();
  if (!task) return <Pressable style={{ flex: 1 }} onPress={close} />;
  const rows = kind === 'why'
    ? [{ k: '', v: task.why || PSYCH.short + ' hasn’t added a reason yet. Ask about it at your next session.' }]
    : [{ k: 'What to do', v: task.detail }, { k: 'Takes about', v: task.mins + ' minutes' }, { k: 'You’ll need', v: task.needs || 'Nothing' }, { k: 'Sent by', v: PSYCH.name + ' (' + PSYCH.title + ') · ' + task.sent }];
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View entering={FadeIn.duration(200)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Pressable style={{ flex: 1, backgroundColor: '#0F274640' }} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(250)}>
        <SheetFrame kicker={kind === 'why' ? 'Why ' + PSYCH.short + ' suggested this' : 'About this task'} title={task.title} onClose={close}>
          {rows.map((r, i) => (
            <View key={i}>
              {r.k ? <Text style={T.small}>{r.k}</Text> : null}
              <Text style={T.body16}>{r.v}</Text>
            </View>
          ))}
        </SheetFrame>
      </Animated.View>
    </View>
  );
}
