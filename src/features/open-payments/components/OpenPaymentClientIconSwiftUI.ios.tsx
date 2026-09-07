import { Host } from '@expo/ui/swift-ui';

import NativeSheetFieldIcon from '@/components/native/NativeSheetFieldIcon';

export default function OpenPaymentClientIconSwiftUI() {
  return (
    <Host style={{ height: 54, width: 54 }}>
      <NativeSheetFieldIcon systemImage="person.crop.circle.fill" />
    </Host>
  );
}
