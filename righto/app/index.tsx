import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Background, Logo, F } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';

/** Opening screen. Auto-advances after 2.2s or on tap. First launch → Consent (PRIVACY.md §3). */
export default function Splash() {
  const onboarded = useStore((s) => s.onboarded);
  const role = useStore((s) => s.role);
  const next = () => router.replace(!onboarded ? '/consent' : role === 'psych' ? '/psych' : '/home');
  useEffect(() => { const t = setTimeout(next, 2200); return () => clearTimeout(t); }, [onboarded, role]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Background splash>
      <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Open Righto" style={{ flex: 1 }}>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center', gap: 22, transform: [{ translateY: -60 }] }}>
          <Logo size={104} />
          <Text style={{ fontFamily: F.sans, fontSize: 12, letterSpacing: 4, lineHeight: 24, textAlign: 'center', color: colors.navy }}>YOUR WAY{'\n'}FORWARD.</Text>
        </View>
        <View style={{ flex: 1.3 }} />
      </Pressable>
    </Background>
  );
}
