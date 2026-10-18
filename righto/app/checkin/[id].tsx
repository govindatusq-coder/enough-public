import { useState } from 'react';
import { ScrollView, Text, View, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, CircleHalf, Leaf, ClockCountdown } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, Field, PrimaryButton, BottomBar, CheckRow, NotMonitored, SupportLink, IconCircle, T, F, MissingTask } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore, useTask } from '../../src/store';
import type { Outcome } from '../../src/logic';
import { PSYCH } from '../../src/logic';

const OUTCOMES: { key: Outcome; label: string; Icon: typeof Check; ic: string; icBg: string }[] = [
  { key: 'done', label: 'Done', Icon: Check, ic: colors.navy, icBg: '#e3eaf0cc' },
  { key: 'partial', label: 'Some of it', Icon: CircleHalf, ic: colors.partlyIcon, icBg: '#F6E7D6cc' },
  { key: 'missed', label: 'Not today', Icon: Leaf, ic: colors.slateLight, icBg: '#ffffff80' },
];

/** Check-in — the record, in the client's own words. Shared only if the client says so (APP 5 notice + toggle). */
export default function CheckIn() {
  const { id, outcome: initial } = useLocalSearchParams<{ id: string; outcome?: Outcome }>();
  const task = useTask(id);
  const record = useStore((s) => s.record);
  const shareDefault = useStore((s) => s.shareDefault);
  const [outcome, setOutcome] = useState<Outcome | null>(initial ?? null);
  const [helped, setHelped] = useState('');
  const [next, setNext] = useState('');
  const [share, setShare] = useState(shareDefault);
  if (!task) return <MissingTask />;

  const save = () => {
    if (!outcome) return;
    record(task.id, outcome, helped, next, share);
    router.replace({ pathname: '/again/[id]', params: { id: task.id, outcome } });
  };

  return (
    <Background>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BackRow />
        <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 4 }}>
            <Kicker>{task.title}</Kicker>
            <Text style={[T.h1, { marginTop: 8 }]}>How did it go?</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {OUTCOMES.map((o) => {
              const on = outcome === o.key;
              return (
                <Pressable key={o.key} onPress={() => setOutcome(o.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ flex: 1 }}>
                  <Glass radius={20} tint={on ? '#fbf8f1b0' : undefined} style={{ borderWidth: 1.5, borderColor: on ? colors.navy : '#ffffffa8', minHeight: 112, paddingVertical: 16, paddingHorizontal: 6, alignItems: 'center', gap: 8 }}>
                    <IconCircle bg={o.icBg}><o.Icon size={22} weight="light" color={o.ic} /></IconCircle>
                    <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 20, color: colors.navy, textAlign: 'center' }}>{o.label}</Text>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
          <Glass style={{ padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Kicker>What you learned</Kicker>
              <Text style={T.small}>Optional</Text>
            </View>
            <Field label={outcome === 'missed' ? 'What got in the way?' : 'What helped?'} placeholder="One line is plenty" value={helped} onChangeText={setHelped} labelStyle={{ fontSize: 16 }} />
            <Field label="What would you change next time?" placeholder="e.g. Go before checking messages" value={next} onChangeText={setNext} labelStyle={{ fontSize: 16 }} />
            <CheckRow size={20} on={share} onPress={() => setShare(!share)} label={'Share this check-in with ' + PSYCH.short + '. They’ll see it before your next session.'} />
            <NotMonitored Icon={ClockCountdown} />
          </Glass>
          <SupportLink />
        </ScrollView>
        <BottomBar>
          <PrimaryButton label="Save check-in" disabled={!outcome} onPress={save} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Background>
  );
}
