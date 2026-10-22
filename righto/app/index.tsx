import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Background, Logo, F } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { cloudMode, needsMfa, useCloud } from '../src/backend/cloud';

const MIN_MS = 2200;

/** Opening screen. Auto-advances after 2.2s (once the account state is known) or on tap. First launch → Consent (PRIVACY.md §3). */
export default function Splash() {
  const onboarded = useStore((s) => s.onboarded);
  const consentAt = useStore((s) => s.consentAt);
  const guest = useStore((s) => s.guest);
  const role = useStore((s) => s.role);
  const ready = useCloud((c) => c.ready);
  const session = useCloud((c) => c.session);
  const profile = useCloud((c) => c.profile);
  const link = useCloud((c) => c.link);
  const known = !cloudMode() || ready;
  const mounted = useRef(Date.now());

  const dest = (): Parameters<typeof router.replace>[0] => {
    if (!cloudMode()) return !onboarded ? '/consent' : role === 'psych' ? '/psych' : '/home';
    if (session && !profile) return '/account'; // signed in through Google, role and name still to come
    if (!session || !profile) return guest && onboarded ? '/home' : consentAt ? '/account' : '/consent';
    if (profile.role === 'psych') return needsMfa() ? '/mfa' : '/psych';
    if (onboarded) return '/home';
    return link ? '/applock' : '/link';
  };
  const next = () => { if (known) router.replace(dest()); };

  useEffect(() => {
    if (!known) return;
    const t = setTimeout(next, Math.max(0, MIN_MS - (Date.now() - mounted.current)));
    return () => clearTimeout(t);
  }, [known, onboarded, role, session, profile, link, guest]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Background splash>
      <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Open Best of You" style={{ flex: 1 }}>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center', gap: 22, transform: [{ translateY: -60 }] }}>
          <Logo size={64} />
          <Text style={{ fontFamily: F.sans, fontSize: 12, letterSpacing: 4, lineHeight: 24, textAlign: 'center', color: colors.navy }}>WHAT COULD{'\n'}BE DIFFERENT?</Text>
        </View>
        <View style={{ flex: 1.3 }} />
      </Pressable>
    </Background>
  );
}
