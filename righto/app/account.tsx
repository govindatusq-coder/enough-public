import { useState } from 'react';
import { ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { EnvelopeSimple, SignIn, UserPlus } from 'phosphor-react-native';
import { Background, Glass, Kicker, Logo, Field, Chip, PrimaryButton, TextButton, BottomBar, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { signIn, signUp, needsMfa, useCloud, type Role, type Profile } from '../src/backend/cloud';
import { toast } from '../src/toast';

const AHPRA = /^PSY\d{10}$/i;

/** Where a signed-in person goes next. Psychologists must pass MFA before any client data is reachable. */
export function afterAuth(p: Profile | null) {
  if (!p) { toast('No Righto account found for that sign-in. Create one below.'); return; }
  const st = useStore.getState();
  if (p.role === 'psych') { router.replace(needsMfa() ? '/mfa' : '/psych'); if (!needsMfa()) st.set({ onboarded: true }); return; }
  if (st.onboarded) router.replace('/home');
  else router.replace(useCloud.getState().link ? '/applock' : '/link');
}

/** Sign in or create an account. Email + password go to the Supabase project in Sydney; the profile row sets the role. */
export default function Account() {
  const top = useTop();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [role, setRole] = useState<Role>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [practice, setPractice] = useState('');
  const [ahpra, setAhpra] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canUp = emailOk && password.length >= 8 && name.trim().length > 0 && (role === 'client' || (practice.trim() && AHPRA.test(ahpra.trim())));
  const canIn = emailOk && password.length > 0;

  const go = async () => {
    setErr(''); setBusy(true);
    try {
      if (mode === 'in') {
        afterAuth(await signIn(email, password));
      } else {
        const r = await signUp({ email, password, role, display_name: name.trim(), practice: practice.trim(), ahpra: ahpra.trim().toUpperCase() });
        if (r === 'confirm') { setConfirmSent(true); setMode('in'); }
        else afterAuth(useCloud.getState().profile);
      }
    } catch (e) {
      const m = (e as Error).message || 'Something went wrong.';
      setErr(/confirm/i.test(m) ? 'Please confirm your email first. Check your inbox, then sign in.' : /already registered/i.test(m) ? 'There is already an account for that email. Sign in instead.' : m);
    } finally { setBusy(false); }
  };

  return (
    <Background>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: top + 19, paddingHorizontal: 22, paddingBottom: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Logo size={34} />
          <View>
            <Kicker>{mode === 'up' ? 'Step 2 of 5 · Your account' : 'Welcome back'}</Kicker>
            <Text style={[T.h1, { marginVertical: 8 }]}>{mode === 'up' ? 'Create your account' : 'Sign in'}</Text>
            <Text style={T.muted}>{mode === 'up' ? 'Your homework and check-ins are stored in Australia and only you, and the psychologist you link with, can see them.' : 'Your details are stored in Australia. Only you and the psychologist you link with can see them.'}</Text>
          </View>

          {confirmSent && (
            <Glass style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <EnvelopeSimple size={22} weight="light" color={colors.steel} style={{ marginTop: 2 }} />
              <Text style={[T.body16, { flex: 1 }]}>We sent a confirmation link to {email.trim()}. Open it, then sign in here.</Text>
            </Glass>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Create account" selected={mode === 'up'} onPress={() => { setMode('up'); setErr(''); }} />
            <Chip label="Sign in" selected={mode === 'in'} onPress={() => { setMode('in'); setErr(''); }} />
          </View>

          <Glass style={{ padding: 18, gap: 16 }}>
            {mode === 'up' && (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={T.label}>I am</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Chip label="Doing homework" selected={role === 'client'} onPress={() => setRole('client')} style={{ borderRadius: 40, paddingVertical: 0 }} />
                    <Chip label="A psychologist" selected={role === 'psych'} onPress={() => setRole('psych')} style={{ borderRadius: 40, paddingVertical: 0 }} />
                  </View>
                </View>
                <Field label="Your name" labelStyle={T.label} placeholder={role === 'psych' ? 'e.g. Dr Maya Chen' : 'e.g. Sam'} value={name} onChangeText={setName} inputProps={{ autoCapitalize: 'words', autoComplete: 'name', textContentType: 'name' }} />
              </>
            )}
            <Field label="Email" labelStyle={T.label} placeholder="you@example.com" value={email} onChangeText={setEmail} inputProps={{ keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, autoComplete: 'email', textContentType: 'emailAddress' }} />
            <Field label="Password" labelStyle={T.label} hint={mode === 'up' ? 'At least 8 characters.' : undefined} placeholder="••••••••" value={password} onChangeText={setPassword} inputProps={{ secureTextEntry: true, autoCapitalize: 'none', autoComplete: mode === 'up' ? 'new-password' : 'password', textContentType: mode === 'up' ? 'newPassword' : 'password' }} />
            {mode === 'up' && role === 'psych' && (
              <>
                <Field label="Practice" labelStyle={T.label} placeholder="e.g. Harbour Psychology, Sydney" value={practice} onChangeText={setPractice} inputProps={{ autoCapitalize: 'words' }} />
                <Field label="Ahpra registration" labelStyle={T.label} hint="Shown to clients before they link with you, so they can check it on the Ahpra register." placeholder="PSY0001234567" value={ahpra} onChangeText={setAhpra} inputProps={{ autoCapitalize: 'characters', autoCorrect: false }} />
              </>
            )}
            {err ? <Text style={[T.meta, { color: colors.navy, fontFamily: F.serifIt }]}>{err}</Text> : null}
          </Glass>
          {mode === 'up' && role === 'psych' && <Text style={[T.muted, { fontSize: 15, lineHeight: 22, paddingHorizontal: 4 }]}>Psychologist accounts need an authenticator app (two-step sign-in) before any client record can be opened.</Text>}
        </ScrollView>
        <BottomBar style={{ paddingTop: 10, gap: 4, alignItems: 'center' }}>
          <PrimaryButton label={busy ? 'One moment…' : mode === 'up' ? 'Create account' : 'Sign in'} disabled={busy || (mode === 'up' ? !canUp : !canIn)} style={{ alignSelf: 'stretch' }}
            icon={mode === 'up' ? <UserPlus size={20} weight="light" color={colors.cream} /> : <SignIn size={20} weight="light" color={colors.cream} />} onPress={go} />
          <TextButton label="Not now" onPress={() => router.replace('/')} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Background>
  );
}
