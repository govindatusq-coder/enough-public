import { create } from 'zustand';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';
import { F } from './ui';

type ToastState = { msg: string; show: (msg: string) => void; hide: () => void };
let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastState>()((set) => ({
  msg: '',
  show: (msg) => {
    set({ msg });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ msg: '' }), 3000);
  },
  hide: () => set({ msg: '' }),
}));

export const toast = (msg: string) => useToast.getState().show(msg);

export function ToastHost() {
  const msg = useToast((s) => s.msg);
  const insets = useSafeAreaInsets();
  if (!msg) return null;
  return (
    <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(200)} pointerEvents="none"
      accessibilityLiveRegion="polite" accessibilityRole="alert"
      style={{ position: 'absolute', top: insets.top + 11, left: 14, right: 14, zIndex: 50, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffffa8', shadowColor: colors.navy, shadowOpacity: 0.15, shadowRadius: 35, shadowOffset: { width: 0, height: 8 }, elevation: 0 }}>
      <BlurView intensity={40} tint="light" blurMethod="dimezisBlurView" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} colors={['#fbf8f1e8', '#f6e7d6d0']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 }}>
        <CheckCircle size={22} weight="fill" color={colors.navy} />
        <Text style={{ flex: 1, fontFamily: F.serif, fontSize: 15, lineHeight: 21, color: colors.navy }}>{msg}</Text>
      </View>
    </Animated.View>
  );
}
