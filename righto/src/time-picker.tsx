import React, { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SheetFrame, PrimaryButton, TextButton } from './ui';
import { formatTime, parseTime } from './logic';

type Pending = { value: Date; onPick: (time: string) => void };

/** A "pick your own time" sheet. iOS gets an inline spinner in a bottom sheet; Android uses the system clock dialog. */
export function useTimePicker() {
  const [pending, setPending] = useState<Pending | null>(null);

  const open = (current: string, onPick: (time: string) => void) => {
    const { hour, minute } = parseTime(current);
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    setPending({ value: d, onPick });
  };

  let element: React.ReactNode = null;
  if (pending && Platform.OS === 'android') {
    element = (
      <DateTimePicker value={pending.value} mode="time" display="default"
        onChange={(e: DateTimePickerEvent, d?: Date) => { setPending(null); if (e.type === 'set' && d) pending.onPick(formatTime(d)); }} />
    );
  } else if (pending) {
    element = (
      <Modal transparent animationType="fade" visible onRequestClose={() => setPending(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0F274640' }} onPress={() => setPending(null)} accessibilityRole="button" accessibilityLabel="Cancel" />
          <SheetFrame kicker="Remind me at" title="Choose a time" onClose={() => setPending(null)} got={null}>
            <DateTimePicker value={pending.value} mode="time" display="spinner" minuteInterval={5} themeVariant="light" textColor="#0F2746" style={{ alignSelf: 'center' }}
              onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) setPending({ ...pending, value: d }); }} />
            <PrimaryButton label={'Use ' + formatTime(pending.value)} onPress={() => { const p = pending; setPending(null); p.onPick(formatTime(p.value)); }} />
            <TextButton label="Cancel" onPress={() => setPending(null)} style={{ alignSelf: 'center' }} />
          </SheetFrame>
        </View>
      </Modal>
    );
  }

  return { open, element };
}
