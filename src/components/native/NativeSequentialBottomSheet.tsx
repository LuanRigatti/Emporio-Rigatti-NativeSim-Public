import { useCallback, useEffect, useRef, useState } from 'react';

import NativeBottomSheet from './NativeBottomSheet';
import type { NativeBottomSheetConfirmation, NativeBottomSheetItem } from './NativeBottomSheet';

export type NativeSequentialBottomSheetProps = {
  bucketPrice?: number;
  items: readonly NativeBottomSheetItem[];
  title: string;
  titleSystemImage?: string;
  subtitle?: string;
  visible: boolean;
  onConfirm?: (confirmation: NativeBottomSheetConfirmation) => void;
  onSelect?: (item: NativeBottomSheetItem) => void;
  onVisibleChange: (visible: boolean) => void;
};

type FlowPhase = 'idle' | 'awaiting-first-dismiss' | 'presenting-form';

/**
 * Coordinates two independent native BottomSheets without timers or a second
 * modal implementation. The form is presented only after the first sheet's
 * native dismissal has completed.
 */
export default function NativeSequentialBottomSheet({
  bucketPrice,
  items,
  onConfirm,
  onSelect,
  onVisibleChange,
  subtitle,
  title,
  titleSystemImage,
  visible,
}: NativeSequentialBottomSheetProps) {
  const [isFirstOpen, setIsFirstOpen] = useState(visible);
  const [isSecondOpen, setIsSecondOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<NativeBottomSheetItem | null>(null);
  const phase = useRef<FlowPhase>('idle');

  const resetFlow = useCallback(() => {
    phase.current = 'idle';
    setIsFirstOpen(false);
    setIsSecondOpen(false);
    setSelectedClient(null);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      phase.current = 'idle';
      setSelectedClient(null);
      setIsSecondOpen(false);
      setIsFirstOpen(true);
      return;
    }

    resetFlow();
  }, [resetFlow, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSelect = useCallback(
    (item: NativeBottomSheetItem) => {
      if (phase.current !== 'idle') return;

      phase.current = 'awaiting-first-dismiss';
      setSelectedClient(item);
      setIsFirstOpen(false);
      onSelect?.(item);
    },
    [onSelect],
  );

  const handleFirstVisibilityChange = useCallback(
    (nextVisible: boolean) => {
      setIsFirstOpen(nextVisible);
      if (!nextVisible && phase.current === 'idle') {
        resetFlow();
        onVisibleChange(false);
      }
    },
    [onVisibleChange, resetFlow],
  );

  const handleFirstDismiss = useCallback(() => {
    if (phase.current !== 'awaiting-first-dismiss' || !selectedClient) return;

    phase.current = 'presenting-form';
    setIsSecondOpen(true);
  }, [selectedClient]);

  const handleSecondVisibilityChange = useCallback(
    (nextVisible: boolean) => {
      setIsSecondOpen(nextVisible);
      if (!nextVisible) {
        resetFlow();
        onVisibleChange(false);
      }
    },
    [onVisibleChange, resetFlow],
  );

  const handleSecondDismiss = useCallback(() => {
    resetFlow();
  }, [resetFlow]);

  return (
    <>
      <NativeBottomSheet
        bucketPrice={bucketPrice}
        items={items}
        onDismiss={handleFirstDismiss}
        onSelect={handleSelect}
        onVisibleChange={handleFirstVisibilityChange}
        presentationStep="list"
        subtitle={subtitle}
        title={title}
        titleSystemImage={titleSystemImage}
        visible={isFirstOpen}
      />
      <NativeBottomSheet
        bucketPrice={bucketPrice}
        items={items}
        onConfirm={onConfirm}
        onDismiss={handleSecondDismiss}
        onVisibleChange={handleSecondVisibilityChange}
        presentationStep="form"
        selectedItem={selectedClient}
        subtitle={subtitle}
        title={title}
        titleSystemImage={titleSystemImage}
        visible={isSecondOpen}
      />
    </>
  );
}
