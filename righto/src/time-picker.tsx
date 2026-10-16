import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Clock } from 'phosphor-react-native';
import { colors } from './theme';
import { F } from './ui';
import { timeToDate, dateToTime } from './utils/time';

const DEFAULT = '8:00 am';

/**
 * "At a time I choose" pill with a time picker. iOS shows the compact inline picker on the right;
 * Android opens the system clock dialog when the pill is tapped. Selected = 1px navy border + #fbf8f1b0.
 */
export function TimePill({ label, value, selected, onChange }: { label: string; value: string | null; selected: boolean; onChange: (time: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = value || DEFAULT;

  const onPick = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'dismissed' || !d) return;
    onChange(dateToTime(d));
  };

  return (
    <Pressable onPress={() => (Platform.OS === 'android' ? setOpen(true) : onChange(current))} accessibilityRole="button" accessibilityLabel="Pick your own reminder time" accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 50, paddingLeft: 16, paddingRight: 6, paddingVertical: 4, borderRadius: 40, borderWidth: 1, borderColor: selected ? colors.navy : '#0F274633', backgroundColor: selected ? '#fbf8f1b0' : '#fbf8f170' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Clock size={18} weight="light" color={colors.steel} />
        <Text style={{ fontFamily: F.serif, fontSize: 16, lineHeight: 20, color: colors.navy, flexShrink: 1 }}>{label}</Text>
      </View>
      {Platform.OS === 'ios' ? (
        <DateTimePicker value={timeToDate(current)} mode="time" display="compact" minuteInterval={5} themeVariant="light" accentColor={colors.navy} onChange={onPick} accessibilityLabel="Pick your own reminder time" />
      ) : (
        <View style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 30, borderWidth: 1, borderColor: '#ffffffc4', backgroundColor: '#ffffff80', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.serif, fontSize: 16, color: colors.navy }}>{value || 'Pick a time'}</Text>
        </View>
      )}
      {Platform.OS === 'android' && open && <DateTimePicker value={timeToDate(current)} mode="time" display="default" onChange={onPick} />}
    </Pressable>
  );
}
