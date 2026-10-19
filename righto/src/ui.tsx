import React from 'react';
import { View, Text, Pressable, ImageBackground, StyleSheet, TextInput, Switch, type ViewStyle, type TextStyle, type TextInputProps, Linking, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lifebuoy, Check, CaretLeft, Coffee, ForkKnife, Moon, PencilSimpleLine, X, House, BookOpen, Users, type IconProps } from 'phosphor-react-native';
import { colors } from './theme';
import type { Outcome, Look, RoutineId } from './logic';
import { useStore } from './store';

/** Where the righto logo and a fallback Back go: the psychologist's Clients list or the client's Home. */
export const homeRoute = () => (useStore.getState().role === 'psych' ? '/psych' : '/home') as '/psych' | '/home';

export const F = { serif: 'Newsreader_400Regular', serifMed: 'Newsreader_500Medium', serifIt: 'Newsreader_400Regular_Italic', sans: 'DMSans_500Medium', script: 'MsMadi_400Regular' };
export const bgImage = require('../assets/background-coast.webp');
const fill = StyleSheet.absoluteFill;
/** Android gets flat translucent surfaces: expo-blur does not blur there without a blur target, and absolutely
 *  positioned overlay layers were being inset by the card's padding, which showed as a ring inside every card.
 *  A backgroundColor on the card itself covers its whole box, so it cannot be inset. iOS keeps the frosted glass. */
export const FLAT = Platform.OS === 'android';
const FLAT_GLASS = '#fbf8f1c4';
const FLAT_NAVY = '#0f2746e8';

const LAYOUT_KEYS = ['padding', 'paddingHorizontal', 'paddingVertical', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd', 'gap', 'rowGap', 'columnGap', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap'];
/** Absolute overlays (blur, gradient, photo) must sit on a box without padding: on Android they are inset by it. So padding and inner layout move to a content View. */
function splitLayout(style?: ViewStyle | ViewStyle[]): [ViewStyle, ViewStyle] {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const k of Object.keys(flat)) (LAYOUT_KEYS.includes(k) ? inner : outer)[k] = flat[k];
  return [outer as ViewStyle, inner as ViewStyle];
}

// ---- Layout helpers ------------------------------------------------------------------------------

/** Reference designs assume a 47pt status bar; offsets are relative to the real safe-area inset. */
export const useTop = () => useSafeAreaInsets().top;
export const useBottom = () => Math.max(useSafeAreaInsets().bottom, 20);

export function Background({ children, splash }: { children?: React.ReactNode; splash?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ImageBackground source={bgImage} resizeMode="cover" blurRadius={splash ? 0 : 3} style={[fill, { margin: -12 }]} />
      {splash ? (
        <LinearGradient colors={['#fbf8f1f0', '#fbf8f1c0', '#fbf8f100']} locations={[0, 0.38, 0.7]} style={fill} />
      ) : (
        <>
          <LinearGradient colors={['#fbf8f180', '#f6e7d6a8', '#0f274670']} locations={[0, 0.65, 1]} style={fill} />
          <LinearGradient colors={['#fbf8f1b0', '#fbf8f138', '#fbf8f158']} locations={[0, 0.45, 1]} style={fill} />
        </>
      )}
      {children}
    </View>
  );
}

export function Glass({ children, style, radius = 22, intensity = 40, tint }: { children?: React.ReactNode; style?: ViewStyle | ViewStyle[]; radius?: number; intensity?: number; tint?: string }) {
  const [outer, inner] = splitLayout(style);
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffffa8', shadowColor: colors.navy, shadowOpacity: 0.08, shadowRadius: 35, shadowOffset: { width: 0, height: 8 }, elevation: 0 }, FLAT ? { backgroundColor: tint ?? FLAT_GLASS } : null, outer]}>
      {!FLAT && <BlurView intensity={intensity} tint="light" blurMethod="dimezisBlurView" style={fill} />}
      {!FLAT && <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} colors={['#fbf8f142', '#f6e7d61f', '#fbf8f133']} locations={[0, 0.6, 1]} style={fill} />}
      {!FLAT && tint ? <View style={[fill, { backgroundColor: tint }]} /> : null}
      {!FLAT && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: '#ffffffe0' }} />}
      <View style={[{ flexGrow: 1 }, inner]}>{children}</View>
    </View>
  );
}

const NAVY = {
  default: { colors: ['#0f2746e8', '#0f2746c4'] as [string, string], end: { x: 1, y: 0.6 }, radius: 22, padding: 18 },
  soft: { colors: ['#0f2746e0', '#0f2746b8'] as [string, string], end: { x: 1, y: 0.6 }, radius: 22, padding: 18 },
  pledge: { colors: ['#0f2746ee', '#0f2746c0'] as [string, string], end: { x: 0.6, y: 1 }, radius: 24, padding: 22 },
};
export function NavyCard({ children, style, variant = 'default' }: { children: React.ReactNode; style?: ViewStyle; variant?: keyof typeof NAVY }) {
  const v = NAVY[variant];
  const [outer, inner] = splitLayout(style);
  return (
    <View style={[{ borderRadius: v.radius, overflow: 'hidden', shadowColor: colors.navy, shadowOpacity: 0.19, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 0 }, FLAT ? { backgroundColor: FLAT_NAVY } : null, outer]}>
      {!FLAT && <ImageBackground source={bgImage} resizeMode="cover" style={fill} />}
      {!FLAT && <LinearGradient start={{ x: 0, y: 0 }} end={v.end} colors={v.colors} style={fill} />}
      <View style={[{ flexGrow: 1, padding: v.padding }, inner]}>{children}</View>
    </View>
  );
}

// ---- Type -------------------------------------------------------------------------------------

export const T = StyleSheet.create({
  kicker: { fontFamily: F.sans, fontSize: 11, lineHeight: 15, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.slate },
  h1: { fontFamily: F.serif, fontSize: 34, lineHeight: 37, letterSpacing: -1, color: colors.navy },
  h2: { fontFamily: F.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.5, color: colors.navy },
  title: { fontFamily: F.serif, fontSize: 22, lineHeight: 27, color: colors.navy },
  body: { fontFamily: F.serif, fontSize: 17, lineHeight: 25, color: colors.navy },
  body16: { fontFamily: F.serif, fontSize: 16, lineHeight: 23, color: colors.navy },
  muted: { fontFamily: F.serif, fontSize: 16, lineHeight: 24, color: colors.slate },
  italic: { fontFamily: F.serifIt, fontSize: 16, lineHeight: 23, color: colors.slate },
  meta: { fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: colors.slate },
  small: { fontFamily: F.serif, fontSize: 13, lineHeight: 18, color: colors.slate },
  label: { fontFamily: F.serifMed, fontSize: 15, lineHeight: 20, color: colors.navy },
});

export const Kicker = ({ children, style }: { children: React.ReactNode; style?: TextStyle | TextStyle[] }) => <Text style={[T.kicker, style]}>{children}</Text>;

export function Logo({ size = 30, onNavy }: { size?: number; onNavy?: boolean }) {
  const dot = Math.max(4, Math.round(size / 8.7));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessible accessibilityLabel="Righto">
      <Text style={{ fontFamily: F.script, fontSize: size, lineHeight: Math.round(size * 1.5), color: onNavy ? colors.cream : colors.navy, letterSpacing: size > 60 ? -1 : 0, marginLeft: -Math.round(size * 0.1), marginVertical: -Math.round(size * 0.15) }}>{'\u00A0'}righto</Text>
      <View style={{ width: dot, height: dot, borderRadius: 99, backgroundColor: onNavy ? colors.champagneLight : colors.champagne, marginLeft: size > 60 ? 6 : 3, marginBottom: Math.round(size * 0.3) }} />
    </View>
  );
}

// ---- Buttons ----------------------------------------------------------------------------------

type BtnProps = { label: string; onPress?: () => void; icon?: React.ReactNode; iconRight?: React.ReactNode; disabled?: boolean; style?: ViewStyle; accessibilityLabel?: string };

export function PrimaryButton({ label, onPress, icon, iconRight, disabled, style, accessibilityLabel }: BtnProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [{ minHeight: 54, borderRadius: 40, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, shadowColor: colors.navy, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, style]}>
      {icon}
      <Text style={{ fontFamily: F.serifMed, fontSize: 17, lineHeight: 22, color: colors.cream, textAlign: 'center' }}>{label}</Text>
      {iconRight}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon, disabled, style, accessibilityLabel, size = 17 }: BtnProps & { size?: number }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ minHeight: 52, borderRadius: 40, borderWidth: 1, borderColor: '#0F274640', backgroundColor: pressed ? '#f6e7d6' : '#fbf8f170', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20, opacity: disabled ? 0.45 : 1 }, style]}>
      {icon}
      <Text style={{ fontFamily: F.serifMed, fontSize: size, lineHeight: size + 5, color: colors.navy }}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress, color = colors.slate, style, italic, size = 16, weight, icon, textStyle, accessibilityLabel }: BtnProps & { color?: string; italic?: boolean; size?: number; weight?: 'medium'; textStyle?: TextStyle }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [{ minHeight: 44, paddingHorizontal: 16, borderRadius: 30, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: pressed ? '#fbf8f160' : 'transparent' }, style]}>
      {icon}
      {/* Android measures italic glyphs slightly narrow and clips the last letter; a little trailing room avoids that. */}
      <Text style={[{ fontFamily: italic ? F.serifIt : weight ? F.serifMed : F.serif, fontSize: size, lineHeight: size + 6, color, flexShrink: 1, paddingRight: italic && FLAT ? 6 : 0 }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, style }: { label: string; selected?: boolean; onPress?: () => void; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }}
      style={[{ minHeight: 44, maxWidth: '100%', flexShrink: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', backgroundColor: selected ? colors.navy : '#fbf8f170', borderWidth: 1, borderColor: selected ? colors.navy : '#0F274633' }, style]}>
      <Text style={{ fontFamily: F.serif, fontSize: 16, lineHeight: 20, color: selected ? colors.cream : colors.navy, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** The righto wordmark as a button: always returns to the start of Home (Home resets its picker on focus). */
export function HomeLogo({ size = 26, style }: { size?: number; style?: ViewStyle }) {
  return (
    <Pressable onPress={() => router.dismissTo(homeRoute())} accessibilityRole="button" accessibilityLabel="Righto. Go to Home" hitSlop={10}
      style={[{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }, style]}>
      <Logo size={size} />
    </Pressable>
  );
}

export function BackRow({ label = 'Back', onPress, right, style, logo = true }: { label?: string; onPress?: () => void; right?: React.ReactNode; style?: ViewStyle; logo?: boolean }) {
  const top = useTop();
  return (
    <View style={[{ paddingTop: top + 5, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, style]}>
      <Pressable onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.dismissTo(homeRoute())))} accessibilityRole="button" accessibilityLabel={label === 'Back' ? 'Back' : 'Back to ' + label}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 10, borderRadius: 30, backgroundColor: pressed ? '#fbf8f160' : 'transparent' })}>
        <CaretLeft size={18} weight="light" color={colors.navy} />
        <Text style={{ fontFamily: F.serif, fontSize: 16, color: colors.navy }}>{label}</Text>
      </Pressable>
      {logo && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: top + 5, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <HomeLogo />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View>
    </View>
  );
}

/** Shown when a task route cannot find its task (removed, or not saved yet). Never a blank page. */
export function MissingTask() {
  return (
    <Background>
      <BackRow />
      <View style={{ paddingHorizontal: 22, paddingTop: 12, gap: 12 }}>
        <Text style={T.h2}>This task isn’t here any more</Text>
        <Text style={T.muted}>It may have been removed, or it hasn’t finished saving yet. Go back to Home and try again in a moment.</Text>
        <PrimaryButton label="Go to Home" onPress={() => { if (router.canDismiss()) router.dismissAll(); router.replace(homeRoute()); }} style={{ alignSelf: 'flex-start', paddingHorizontal: 28 }} />
      </View>
    </Background>
  );
}

/** The "?" (Why) and "i" (About) buttons. 22pt visual, 44pt hit area. */
export function InfoButtons({ taskId, onNavy }: { taskId: string; onNavy?: boolean }) {
  const open = (kind: 'why' | 'info') => router.push({ pathname: '/sheet', params: { id: taskId, kind } });
  const circle: ViewStyle = { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: onNavy ? 'transparent' : '#fbf8f1a0', borderWidth: 1, borderColor: onNavy ? '#FBF8F166' : '#0F274633' };
  const txt = onNavy ? colors.cream : colors.navy;
  return (
    <View style={{ flexDirection: 'row', paddingRight: 6 }}>
      <Pressable onPress={() => open('why')} accessibilityRole="button" accessibilityLabel="Why this task?" style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={circle}><Text style={{ fontFamily: F.serif, fontSize: 14, lineHeight: 16, color: txt }}>?</Text></View>
      </Pressable>
      <Pressable onPress={() => open('info')} accessibilityRole="button" accessibilityLabel="More about this task" style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={circle}><Text style={{ fontFamily: F.serifMed, fontStyle: 'italic', fontSize: 14, lineHeight: 16, color: txt }}>i</Text></View>
      </Pressable>
    </View>
  );
}

// ---- Status visuals -------------------------------------------------------------------------------

/** done = navy fill + check · partial = left half navy · missed = faded · null = dashed "to do" ring */
export function StatusDot({ outcome, size = 20 }: { outcome: Outcome | null | undefined; size?: number }) {
  const label = outcome === 'done' ? 'Done' : outcome === 'partial' ? 'Partly done' : outcome === 'missed' ? 'Not today' : 'To do';
  return (
    <View accessible accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.25, borderColor: colors.navy, borderStyle: outcome ? 'solid' : 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: outcome === 'missed' ? 0.45 : 1, backgroundColor: outcome === 'done' ? colors.navy : outcome === 'missed' ? '#0f274626' : 'transparent' }}>
      {outcome === 'partial' && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', backgroundColor: colors.navy }} />}
      {outcome === 'done' && <Check size={size * 0.55} weight="bold" color={colors.cream} />}
    </View>
  );
}

export function Seg({ look, height, radius, style }: { look: Look; height: number; radius?: number; style?: ViewStyle }) {
  const r = radius ?? height / 2;
  return (
    <View style={[{ height, borderRadius: r, borderWidth: 1.25, borderColor: colors.navy, borderStyle: look.bs, opacity: look.op, overflow: 'hidden', backgroundColor: look.bg === 'half' || look.bg === 'transparent' ? 'transparent' : look.bg }, style]}>
      {look.bg === 'half' && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', backgroundColor: colors.navy }} />}
    </View>
  );
}

export function SegBar({ segs, height }: { segs: { key: string; label: string; bs: Look['bs']; bg: Look['bg']; op: number }[]; height: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, height }} accessible accessibilityLabel={segs.map((s) => s.label).join(', ')}>
      {segs.map((g) => <Seg key={g.key} look={g} height={height} style={{ flex: 1 }} />)}
    </View>
  );
}

export function Pill({ label, bg, fg, size = 13 }: { label: string; bg: string; fg: string; size?: number }) {
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 11, borderRadius: 30, backgroundColor: bg }}>
      <Text style={{ fontFamily: F.serif, fontSize: size, lineHeight: size + 5, color: fg }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export const Hairline = ({ style }: { style?: ViewStyle }) => <View style={[{ height: StyleSheet.hairlineWidth > 0.5 ? 1 : StyleSheet.hairlineWidth, backgroundColor: '#0f274614' }, style]} />;

// ---- Chrome -------------------------------------------------------------------------------------

export function BottomBar({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const bottom = useBottom();
  return <View style={[{ paddingTop: 12, paddingHorizontal: 18, paddingBottom: bottom, gap: 6, alignItems: 'stretch' }, style]}>{children}</View>;
}

export function TabBar({ active }: { active: 'home' | 'journal' | 'clients' }) {
  const insets = useSafeAreaInsets();
  const tabs = active === 'clients'
    ? [{ k: 'clients' as const, label: 'Clients', Icon: Users, href: '/psych' }]
    : [{ k: 'home' as const, label: 'Home', Icon: House, href: '/home' }, { k: 'journal' as const, label: 'Journal', Icon: BookOpen, href: '/journal' }];
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom > 0 ? insets.bottom - 6 : 16, alignItems: 'center' }}>
      <View style={[{ borderRadius: 60, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffffa8', shadowColor: colors.navy, shadowOpacity: 0.1, shadowRadius: 25, shadowOffset: { width: 0, height: 4 }, elevation: 0 }, FLAT ? { backgroundColor: '#fbf8f1d9' } : null]}>
        {!FLAT && <BlurView intensity={30} tint="light" blurMethod="dimezisBlurView" style={fill} />}
        {!FLAT && <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} colors={['#fbf8f170', '#f6e7d638']} style={fill} />}
        <View style={{ flexDirection: 'row', gap: 3, padding: 5 }} accessibilityRole="tablist">
          {tabs.map(({ k, label, Icon, href }) => {
            const on = k === active;
            return (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { if (!on) router.navigate(href as never); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 20, borderRadius: 40, backgroundColor: on ? colors.navy : 'transparent' }}>
                <Icon size={20} weight={on ? 'fill' : 'light'} color={on ? colors.cream : colors.navy} />
                <Text style={{ fontFamily: F.serifMed, fontSize: 16, color: on ? colors.cream : colors.navy }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, multiline, hint, optional, labelStyle, inputProps }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: string; optional?: boolean; labelStyle?: TextStyle; inputProps?: TextInputProps }) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={[T.body, { fontSize: 17, lineHeight: 22 }, labelStyle]}>{label}{optional ? <Text style={{ fontFamily: F.serif, color: colors.slateLight }}>  Optional</Text> : null}</Text> : null}
      {hint ? <Text style={[T.meta, { color: colors.slateLight, marginTop: -4 }]}>{hint}</Text> : null}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.placeholder} multiline={multiline} accessibilityLabel={label} {...inputProps}
        style={{ minHeight: multiline ? 84 : 46, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ffffffc4', backgroundColor: '#ffffff4d', fontFamily: F.serif, fontSize: 16, lineHeight: 22, color: colors.navy, textAlignVertical: multiline ? 'top' : 'center' }} />
    </View>
  );
}

export function CheckRow({ on, onPress, label, size = 22 }: { on: boolean; onPress: () => void; label: string; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingHorizontal: 4, paddingVertical: 6 }}>
      <View style={{ width: size, height: size, borderRadius: 6, borderWidth: 1.25, borderColor: colors.navy, backgroundColor: on ? colors.navy : '#fbf8f170', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on && <Check size={size * 0.64} weight="bold" color={colors.cream} />}
      </View>
      <Text style={[T.body16, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Switch value={on} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.navy, false: '#0f274633' }} thumbColor={colors.cream} ios_backgroundColor="#0f274633" />;
}

export function SupportLink({ style }: { style?: ViewStyle }) {
  return (
    <Pressable onPress={() => router.push('/support')} accessibilityRole="button" accessibilityLabel="Need support now? Crisis lines and about Righto"
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, alignSelf: 'flex-start', paddingLeft: 16, paddingRight: 18, borderRadius: 20, borderWidth: 1, borderColor: pressed ? colors.navy : '#0F274640', backgroundColor: pressed ? colors.navy : '#0F274614' }, style]}>
      {({ pressed }) => (
        <>
          <Lifebuoy size={20} weight="light" color={pressed ? colors.cream : colors.steel} />
          <Text style={{ fontFamily: F.serif, fontSize: 16, lineHeight: 21, color: pressed ? colors.cream : colors.navy }}>Need support now?</Text>
        </>
      )}
    </Pressable>
  );
}

/** Under every free-text field (COMPLIANCE_REVIEW C1): Righto is not monitored in real time. */
export function NotMonitored({ Icon }: { Icon: React.ComponentType<IconProps> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#0f274614' }}>
      <Icon size={18} weight="light" color={colors.steel} style={{ marginTop: 1 }} />
      <Text style={[T.meta, { flex: 1, lineHeight: 20 }]}>Dr Chen reads these before your session, not in real time. If you need help now, call 000 or Lifeline 13 11 14.</Text>
    </View>
  );
}

export function RoutineIcon({ id, size = 22, color = colors.steel }: { id: RoutineId | string; size?: number; color?: string }) {
  const Icon = id === 'coffee' ? Coffee : id === 'lunch' ? ForkKnife : id === 'own' ? PencilSimpleLine : Moon;
  return <Icon size={size} weight="light" color={color} />;
}

export function IconCircle({ children, size = 42, bg = '#fbf8f1a0' }: { children: React.ReactNode; size?: number; bg?: string }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

/** Bottom sheet chrome used by transparent-modal routes (support, why/about, legal). */
export function SheetFrame({ kicker, title, children, onClose, got = 'Got it' }: { kicker: string; title?: string; children: React.ReactNode; onClose: () => void; got?: string | null }) {
  const bottom = useBottom();
  return (
    <View style={[{ marginHorizontal: 10, marginBottom: 10, borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffffa8', shadowColor: colors.navy, shadowOpacity: 0.15, shadowRadius: 40, shadowOffset: { width: 0, height: -8 }, elevation: 0 }, FLAT ? { backgroundColor: '#fbf8f1f4' } : null]}>
      {!FLAT && <BlurView intensity={30} tint="light" blurMethod="dimezisBlurView" style={fill} />}
      {!FLAT && <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} colors={['#fbf8f1f4', '#f6e7d6f0']} style={fill} />}
      <View style={{ padding: 22, paddingBottom: Math.max(28, bottom - 6), gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Kicker>{kicker}</Kicker>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, marginVertical: -10, marginRight: -12, alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} weight="light" color={colors.navy} />
          </Pressable>
        </View>
        {title ? <Text style={{ fontFamily: F.serif, fontSize: 24, lineHeight: 28, letterSpacing: -0.4, color: colors.navy }}>{title}</Text> : null}
        {children}
        {got ? <SecondaryButton label={got} onPress={onClose} size={16} style={{ marginTop: 6, minHeight: 48 }} /> : null}
      </View>
    </View>
  );
}

export const callLifeline = () => Linking.openURL('tel:131114');
export const call000 = () => Linking.openURL('tel:000');
export const callBeyondBlue = () => Linking.openURL('tel:1300224636');
