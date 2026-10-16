import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, { SlideInDown, FadeIn } from 'react-native-reanimated';
import { Phone } from 'phosphor-react-native';
import { SheetFrame, PrimaryButton, SecondaryButton, T, call000, callLifeline, callBeyondBlue } from '../src/ui';
import { colors } from '../src/theme';

/** "Need support now?" — static crisis lines plus the About Righto statement (INTENDED_PURPOSE.md rule 6). Reachable from every screen. */
export default function Support() {
  const close = () => router.back();
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View entering={FadeIn.duration(200)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Pressable style={{ flex: 1, backgroundColor: '#0F274640' }} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(250)}>
        <SheetFrame kicker="Support" title="Need support now?" onClose={close}>
          <View>
            <Text style={T.small}>If you’re in danger or need urgent help</Text>
            <PrimaryButton label="Call 000" icon={<Phone size={20} weight="light" color={colors.cream} />} onPress={call000} style={{ marginTop: 8 }} accessibilityLabel="Call 000, emergency" />
          </View>
          <View>
            <Text style={T.small}>Lifeline · 24 hours</Text>
            <SecondaryButton label="13 11 14 · lifeline.org.au" icon={<Phone size={20} weight="light" color={colors.navy} />} onPress={callLifeline} style={{ marginTop: 8, minHeight: 48 }} size={16} accessibilityLabel="Call Lifeline 13 11 14" />
          </View>
          <View>
            <Text style={T.small}>Beyond Blue</Text>
            <SecondaryButton label="1300 22 4636" icon={<Phone size={20} weight="light" color={colors.navy} />} onPress={callBeyondBlue} style={{ marginTop: 8, minHeight: 48 }} size={16} accessibilityLabel="Call Beyond Blue 1300 22 4636" />
          </View>
          <View>
            <Text style={T.small}>About Righto</Text>
            <Text style={T.body16}>Righto shares homework from your psychologist, reminds you and keeps your notes. It doesn’t assess, diagnose or treat, and no one is watching it in real time. For anything urgent, use the services above or contact your psychologist.</Text>
          </View>
        </SheetFrame>
      </Animated.View>
    </View>
  );
}
