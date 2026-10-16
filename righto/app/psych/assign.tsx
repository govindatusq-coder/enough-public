import { useState } from 'react';
import { ScrollView, Text, View, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, PaperPlaneTilt } from 'phosphor-react-native';
import { Background, Glass, Kicker, BackRow, Field, Chip, PrimaryButton, BottomBar, T, F } from '../../src/ui';
import { colors } from '../../src/theme';
import { useStore } from '../../src/store';
import { type Tag, type RoutineId, type Suggestion, type GoalAnswers, ROUTINES, MINS, GOALQ, emptyGoal, mkTask, uniq, lc, CLIENT } from '../../src/logic';
import { notifyNewTask } from '../../src/notifications';
import { toast } from '../../src/toast';
import { cloudActive, assignTask } from '../../src/backend/cloud';

type Start = 'client' | 'commitment' | 'goal';

/** Assign homework. The clinician authors everything; Righto shows their words as written and never generates advice (INTENDED_PURPOSE.md rule 1). */
export default function Assign() {
  const { client = CLIENT.name, id = '' } = useLocalSearchParams<{ client?: string; id?: string }>();
  const first = client.split(' ')[0];
  const cloud = cloudActive() && !!id;
  const [busy, setBusy] = useState(false);
  const addTask = useStore((s) => s.addTask);
  const notifDetail = useStore((s) => s.notifDetail);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [why, setWhy] = useState('');
  const [mins, setMins] = useState(10);
  const [needs, setNeeds] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [start, setStart] = useState<Start>('client');
  const [routine, setRoutine] = useState<RoutineId>('coffee');
  const [where, setWhere] = useState('');
  const [how, setHow] = useState('');
  const [goal, setGoal] = useState<GoalAnswers>(emptyGoal());
  const empty = !title.trim() || !why.trim();

  const send = async () => {
    if (cloud) {
      setBusy(true);
      try {
        await assignTask(id, { title, detail, why, mins, needs, tags, start, routine, where, how, goal });
        toast('Sent. ' + first + ' will see it the next time Righto opens.');
        router.back();
      } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
      return;
    }
    let suggestion: Suggestion | null = null;
    if (start === 'commitment' && where.trim() && how.trim()) suggestion = { kind: 'commitment', plan: { routine, where: where.trim(), how: how.trim(), prep: '' } };
    if (start === 'goal' && GOALQ.some((f) => goal[f.k].trim())) suggestion = { kind: 'goal', goal: { ...goal } };
    const lt = lc(title.trim());
    const task = mkTask({
      id: 't' + Date.now(), tags, title: title.trim(), detail: detail.trim() || title.trim(), why: why.trim(), needs: needs.trim() || 'Nothing', mins, sent: 'Today', status: 'new', suggestion, suggest: routine,
      whereOpts: uniq([where.trim(), 'at home', 'at work', 'outside']), howOpts: uniq([how.trim(), lt]), prepOpts: ['set a phone reminder', 'put a note where I’ll see it'],
    });
    addTask(task);
    notifyNewTask(task, notifDetail);
    toast('Sent. ' + first + ' will get an alert now.');
    router.back();
  };

  return (
    <Background>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BackRow label={first} />
        <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 18, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 4 }}>
            <Kicker>For {client}</Kicker>
            <Text style={[T.h1, { marginTop: 8 }]}>New homework</Text>
          </View>
          <Glass style={{ padding: 18, gap: 16 }}>
            <Field label="Task" labelStyle={T.label} placeholder="e.g. Take a 10-minute walk after lunch" value={title} onChangeText={setTitle} />
            <Field label="Instructions" labelStyle={T.label} placeholder="What should they do and notice?" value={detail} onChangeText={setDetail} multiline />
            <Field label="Why this helps" labelStyle={T.label} hint={first + ' sees this when they tap “?”. Righto shows your words as written and never generates advice.'} placeholder="e.g. A short walk adds light and movement when your mood usually dips." value={why} onChangeText={setWhy} multiline />
            <View style={{ gap: 8 }}>
              <Text style={T.label}>Takes about</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MINS.map((m) => <Chip key={m} label={m + ' min'} selected={mins === m} onPress={() => setMins(m)} style={{ borderRadius: 40, paddingVertical: 0 }} />)}
              </View>
            </View>
            <Field label="They’ll need" optional labelStyle={T.label} hint="Shown when they tap “i”." placeholder="e.g. Comfortable shoes" value={needs} onChangeText={setNeeds} />
            <View style={{ gap: 8 }}>
              <Text style={T.label}>Tag it<Text style={{ fontFamily: F.serif, color: colors.slateLight }}>  Optional</Text></Text>
              <Text style={[T.meta, { color: colors.slateLight, marginTop: -4 }]}>Used only to sort when {first} picks “Something quick” or “Something quiet”.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['quick', 'quiet'] as Tag[]).map((k) => <Chip key={k} label={k === 'quick' ? 'Quick' : 'Quiet'} selected={tags.includes(k)} onPress={() => setTags(tags.includes(k) ? tags.filter((x) => x !== k) : [...tags, k])} style={{ borderRadius: 40, paddingVertical: 0 }} />)}
              </View>
            </View>
            <View style={{ gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#0f274614' }}>
              <Text style={T.label}>Talked it through in session?</Text>
              <Text style={[T.meta, { color: colors.slateLight, marginTop: -4 }]}>Suggest how {first} could start. They can change it.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([['client', 'Let them choose'], ['commitment', 'Suggest a commitment'], ['goal', 'Suggest a goal']] as [Start, string][]).map(([k, l]) => <Chip key={k} label={l} selected={start === k} onPress={() => setStart(k)} style={{ borderRadius: 40, paddingVertical: 0 }} />)}
              </View>
            </View>
            {start === 'commitment' && (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={T.label}>When</Text>
                  <View style={{ gap: 6 }}>
                    {ROUTINES.map((x) => (
                      <Pressable key={x.id} onPress={() => setRoutine(x.id)} accessibilityRole="radio" accessibilityState={{ checked: routine === x.id }}
                        style={{ minHeight: 44, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, backgroundColor: routine === x.id ? colors.navy : '#fbf8f170', borderColor: routine === x.id ? colors.navy : '#0F274633' }}>
                        <Text style={{ fontFamily: F.serif, fontSize: 16, lineHeight: 22, color: routine === x.id ? colors.cream : colors.navy }}>{x.anchor} · {x.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Field label="Where" labelStyle={T.label} placeholder="e.g. around the block near work" value={where} onChangeText={setWhere} />
                <Field label="How" labelStyle={T.label} placeholder="e.g. walk for 10 minutes" value={how} onChangeText={setHow} />
              </>
            )}
            {start === 'goal' && GOALQ.map((f) => <Field key={f.k} label={f.pq} labelStyle={T.label} placeholder={f.ph} value={goal[f.k]} onChangeText={(v) => setGoal({ ...goal, [f.k]: v })} />)}
          </Glass>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 4 }}>
            <Bell size={18} weight="light" color={colors.steel} />
            <Text style={[T.meta, { flex: 1, lineHeight: 20 }]}>{first} gets an alert straight away, then chooses how to start. Anything you suggest is a starting point they can change.</Text>
          </View>
        </ScrollView>
        <BottomBar>
          <PrimaryButton label={busy ? 'Sending…' : 'Send to ' + first} iconRight={<PaperPlaneTilt size={18} weight="light" color={colors.cream} />} disabled={empty || busy} onPress={send} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Background>
  );
}
