import { View, Text, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { SlideInDown, FadeIn } from 'react-native-reanimated';
import { SheetFrame, T } from '../src/ui';

const POLICY = [
  ['What we collect', 'Your display name and email, the psychologist you link with, the homework they send you, and the plans, check-ins and notes you choose to record. Your “What feels doable right now?” answer stays on your device and is never stored or shared.'],
  ['Why', 'Only to deliver homework between you and your linked psychologist. No advertising, no sale of data, no marketing use of health information.'],
  ['Where it is stored', 'In Australia. Reminders are scheduled on your phone and carry no health content on the lock screen unless you turn that on.'],
  ['Who can see it', 'You, and your psychologist for the items you mark as shared. Every time they view your record it is logged. You can end sharing at any time.'],
  ['Your rights', 'Download or correct your information and delete your account from Settings → Privacy & data. Complaints: first to the Best of You privacy officer, then to the OAIC.'],
];
const NOTICE = [
  ['Collection notice', 'Best of You (ABN pending) collects your health information to deliver homework set by your psychologist and to let you share your plans and check-ins with them. Information is stored in Australia and is not disclosed overseas. You can access, correct or delete it at any time. Privacy officer: privacy@righto.app.'],
  ['Draft for legal review', 'This notice is a placeholder prepared for the privacy lawyer’s review and a Privacy Impact Assessment before launch.'],
];

export default function Legal() {
  const { kind } = useLocalSearchParams<{ kind: 'policy' | 'notice' }>();
  const close = () => router.back();
  const rows = kind === 'notice' ? NOTICE : POLICY;
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View entering={FadeIn.duration(200)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Pressable style={{ flex: 1, backgroundColor: '#0F274640' }} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(250)} style={{ maxHeight: '85%' }}>
        <SheetFrame kicker={kind === 'notice' ? 'Collection notice' : 'Privacy policy · draft'} title={kind === 'notice' ? 'Before you share anything' : 'How Best of You handles your information'} onClose={close}>
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 12 }}>
            {rows.map(([k, v]) => (
              <View key={k}>
                <Text style={T.small}>{k}</Text>
                <Text style={T.body16}>{v}</Text>
              </View>
            ))}
          </ScrollView>
        </SheetFrame>
      </Animated.View>
    </View>
  );
}
