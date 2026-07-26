import { Stack } from 'expo-router';

import NativeComponentsShowcase from '@/screens/dev/NativeComponentsShowcase';

export default function NativeComponentsShowcaseRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Native Components' }} />
      <NativeComponentsShowcase />
    </>
  );
}
