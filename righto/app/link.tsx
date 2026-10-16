import { useState } from 'react';
import { ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IdentificationCard, Timer, LinkSimple, Ticket } from 'phosphor-react-native';
import { Background, Glass, Kicker, Field, PrimaryButton, TextButton, BottomBar, BackRow, T, F, useTop } from '../src/ui';
import { colors } from '../src/theme';
import { useStore } from '../src/store';
import { PSYCH } from '../src/logic';
import { cloudMode, refreshLink } from '../src/backend/cloud';
import { api, type InvitePreview } from '../src/backend/supabase';
import { toast } from '../src/toast';

const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
const hoursLeft = (iso: string) => Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 3600000));

/** Step 3 of 4 — enter the single-use invite code and confirm the psychologist behind it (COMPLIANCE_REVIEW D3). */
export default function Link() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSettings = from === 'settings';
  const set = useStore((s) => s.set);
  const top = useTop();
  const cloud = cloudMode();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const next = () => { if (fromSettings) router.back(); else router.replace('/applock'); };
  const clean = code.toUpperCase().replace(/[^A-Z2-9]/g, '');

  const lookUp = async () => {
    setBusy(true); setErr('');
    try {
      const p = await api.previewInvite(clean);
      if (!p) setErr('That code isn’t valid any more. Codes work once and expire after 48 hours. Ask your psychologist for a new one.');
      else setPreview(p);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setErr('');
    try {
      if (cloud) { await api.redeemInvite(clean); await refreshLink(); }
      else set({ linked: true });
      toast('Linked with ' + (preview?.display_name ?? PSYCH.short) + '.');
      next();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const who = cloud && preview
    ? { name: preview.display_name, title: preview.title, practice: preview.practice, ahpra: preview.ahpra, initials: initialsOf(preview.display_name), expires: hoursLeft(preview.expires_at) + ' hours' }
    : { name: PSYCH.name, title: PSYCH.title, practice: PSYCH.practice, ahpra: PSYCH.ahpra, initials: PSYCH.initials, expires: '47 hours' };
  const showCard = !cloud || !!preview;

  return (
    <Background>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {fromSettings ? <BackRow label="Privacy & data" /> : null}
        <ScrollView contentContainerStyle={{ paddingTop: fromSettings ? 8 : top + 19, paddingHorizontal: 22, paddingBottom: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View>
            <Kicker>{fromSettings ? 'Link with a psychologist' : 'Step 3 of 5'}</Kicker>
            <Text style={[T.h1, { marginVertical: 8 }]}>{showCard ? 'Confirm your psychologist' : 'Your invite code'}</Text>
            <Text style={T.muted}>{showCard ? 'Check these details match the psychologist you’re seeing.' : 'Your psychologist gives you a ten-character code in session. It works once and expires after 48 hours.'}</Text>
          </View>
          {cloud && !preview && (
            <Glass style={{ padding: 18, gap: 12 }}>
              <Field label="Invite code" labelStyle={T.label} placeholder="e.g. K7PQ2MX9HD" value={code} onChangeText={(v) => { setCode(v); setErr(''); }} inputProps={{ autoCapitalize: 'characters', autoCorrect: false, maxLength: 12 }} />
              {err ? <Text style={[T.meta, { fontFamily: F.serifIt, color: colors.navy }]}>{err}</Text> : null}
            </Glass>
          )}
          {showCard && (
            <Glass style={{ padding: 20, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.serifMed, fontSize: 17, color: colors.cream }}>{who.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.serif, fontSize: 22, lineHeight: 26, color: colors.navy }}>{who.name}</Text>
                  <Text style={T.meta}>{who.title}{who.practice ? ' · ' + who.practice : ''}</Text>
                </View>
              </View>
              <View style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#0f274614' }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><IdentificationCard size={17} weight="light" color={colors.slate} /><Text style={T.meta}>Ahpra registration {who.ahpra || 'not provided'}</Text></View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Timer size={17} weight="light" color={colors.slate} /><Text style={T.meta}>Single-use invite · expires in {who.expires}</Text></View>
              </View>
              {err ? <Text style={[T.meta, { fontFamily: F.serifIt, color: colors.navy }]}>{err}</Text> : null}
            </Glass>
          )}
          <Text style={[T.muted, { fontSize: 15, lineHeight: 22, paddingHorizontal: 4 }]}>Only link with a psychologist you’re seeing. You can end sharing at any time in Settings.</Text>
        </ScrollView>
        <BottomBar style={{ paddingTop: 10, gap: 4, alignItems: 'center' }}>
          {showCard ? (
            <>
              <PrimaryButton label={busy ? 'Linking…' : 'Yes, link with ' + who.name.split(/\s+/).slice(-1)[0]} disabled={busy} icon={<LinkSimple size={20} weight="light" color={colors.cream} />} style={{ alignSelf: 'stretch' }} onPress={confirm} />
              <TextButton label="This isn’t my psychologist" onPress={() => { toast('Not linked. Ask your psychologist for a new invite.'); if (cloud) { setPreview(null); setCode(''); } else router.back(); }} />
            </>
          ) : (
            <>
              <PrimaryButton label={busy ? 'Checking…' : 'Check this code'} disabled={busy || clean.length !== 10} icon={<Ticket size={20} weight="light" color={colors.cream} />} style={{ alignSelf: 'stretch' }} onPress={lookUp} />
              <TextButton label={fromSettings ? 'Cancel' : 'I don’t have a code yet'} onPress={() => { if (!fromSettings) toast('You can enter a code later in Settings → Privacy & data.'); next(); }} />
            </>
          )}
        </BottomBar>
      </KeyboardAvoidingView>
    </Background>
  );
}
