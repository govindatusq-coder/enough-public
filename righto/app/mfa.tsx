import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Linking, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { router } from 'expo-router';
import { ShieldCheck, DeviceMobile, Copy } from 'phosphor-react-native';
import { Background, Glass, Kicker, Logo, Field, PrimaryButton, SecondaryButton, TextButton, BottomBar, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { useCloud, mfaEnroll, mfaVerify, mfaVerifiedFactorId, signOut } from '../src/backend/cloud';
import { toast } from '../src/toast';

/** Psychologists: set up or complete two-step sign-in (TOTP). The project refuses client data to a session without it. */
export default function Mfa() {
  const top = useTop();
  const hasFactor = useCloud((c) => c.hasFactor);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const enrolling = !hasFactor;

  useEffect(() => {
    (async () => {
      try {
        if (hasFactor) { setFactorId(await mfaVerifiedFactorId()); return; }
        const e = await mfaEnroll();
        setFactorId(e.factorId); setSecret(e.secret); setUri(e.uri);
      } catch (e) { setErr((e as Error).message || 'Two-step sign-in is not available right now.'); }
    })();
  }, [hasFactor]);

  const verify = async () => {
    if (!factorId) return;
    setBusy(true); setErr('');
    try {
      await mfaVerify(factorId, code);
      useStore.getState().set({ onboarded: true, role: 'psych' });
      if (router.canDismiss()) router.dismissAll();
      router.replace('/psych');
    } catch (e) { setErr(/invalid|expired/i.test((e as Error).message) ? 'That code didn’t match. Codes change every 30 seconds, try the current one.' : (e as Error).message); }
    finally { setBusy(false); }
  };

  const grouped = secret.replace(/(.{4})/g, '$1 ').trim();

  return (
    <Background>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: top + 19, paddingHorizontal: 22, paddingBottom: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Logo size={34} />
          <View>
            <Kicker>Psychologists · Two-step sign-in</Kicker>
            <Text style={[T.h1, { marginVertical: 8 }]}>{enrolling ? 'Add an authenticator' : 'Enter your code'}</Text>
            <Text style={T.muted}>{enrolling ? 'Client records open only after a second step. Use any authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).' : 'Open your authenticator app and enter the six-digit code for Best of You.'}</Text>
          </View>
          {enrolling && (
            <Glass style={{ padding: 18, gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <DeviceMobile size={22} weight="light" color={colors.steel} />
                <Text style={[T.body16, { flex: 1 }]}>1. Open the authenticator app on this phone, or add the key below on another device.</Text>
              </View>
              {uri ? <SecondaryButton label="Open authenticator app" onPress={() => Linking.openURL(uri).catch(() => toast('No authenticator app found. Add the key by hand instead.'))} /> : null}
              {secret ? (
                <View style={{ gap: 8 }}>
                  <Text style={T.meta}>Or add this key by hand (time-based):</Text>
                  <Text selectable style={{ fontFamily: F.sans, fontSize: 16, letterSpacing: 1, lineHeight: 24, color: colors.navy }}>{grouped}</Text>
                  <TextButton label="Share key" icon={<Copy size={16} weight="light" color={colors.slate} />} onPress={() => Share.share({ message: secret }).catch(() => undefined)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
                </View>
              ) : !err ? <Text style={T.meta}>Preparing your key…</Text> : null}
              <Text style={[T.body16, { paddingTop: 4 }]}>2. Enter the six-digit code the app shows.</Text>
            </Glass>
          )}
          <Glass style={{ padding: 18, gap: 12 }}>
            <Field label="Six-digit code" labelStyle={T.label} placeholder="123 456" value={code} onChangeText={setCode} inputProps={{ keyboardType: 'number-pad', autoComplete: 'one-time-code', textContentType: 'oneTimeCode', maxLength: 7 }} />
            {err ? <Text style={[T.meta, { color: colors.navy, fontFamily: F.serifIt }]}>{err}</Text> : null}
          </Glass>
        </ScrollView>
        <BottomBar style={{ paddingTop: 10, gap: 4, alignItems: 'center' }}>
          <PrimaryButton label={busy ? 'Checking…' : 'Verify'} icon={<ShieldCheck size={20} weight="light" color={colors.cream} />} disabled={busy || !factorId || code.replace(/\s+/g, '').length !== 6} style={{ alignSelf: 'stretch' }} onPress={verify} />
          <TextButton label="Sign out" onPress={async () => { await signOut(); router.replace('/account'); }} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Background>
  );
}
