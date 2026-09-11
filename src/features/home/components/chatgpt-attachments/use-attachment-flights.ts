import { useCallback, useEffect, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Flight } from './composer/attachment-flight';
import { SPRING } from './constants';
import type { LibraryPhoto } from './photos/use-photo-library';

interface FlightOptions {
  collapsePanel: () => void;
  resetPanel: () => void;
  onSettled?: () => void;
}

export function useAttachmentFlights({ collapsePanel, resetPanel, onSettled }: FlightOptions) {
  const [attachments, setAttachments] = useState<LibraryPhoto[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);

  const attach = useSharedValue(0);
  const strip = useSharedValue(0);
  const hasAttachments = attachments.length > 0;

  useEffect(() => {
    strip.set(withSpring(hasAttachments ? 1 : 0, SPRING.strip));
  }, [hasAttachments, strip]);

  const settle = useCallback(() => {
    setFlights([]);
    onSettled?.();
    attach.set(0);
    resetPanel();
  }, [attach, onSettled, resetPanel]);

  const attachAndLeave = useCallback(
    (leaving: Flight[]) => {
      setFlights(leaving);
      setAttachments((prev) => [...prev, ...leaving.map((flight) => flight.photo)]);
      collapsePanel();
      attach.set(
        withSpring(1, SPRING.attach, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(settle);
        }),
      );
    },
    [attach, collapsePanel, settle],
  );

  const addAttachments = useCallback((incoming: LibraryPhoto[]) => {
    setAttachments((prev) => {
      const existing = new Set(prev.map((photo) => photo.id));
      return [...prev, ...incoming.filter((photo) => !existing.has(photo.id))];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((photo) => photo.id !== id));
  }, []);

  return {
    attachments,
    flights,
    isFlying: flights.length > 0,
    attach,
    strip,
    attachAndLeave,
    addAttachments,
    removeAttachment,
  };
}
