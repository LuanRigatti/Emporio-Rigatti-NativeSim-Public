import { NativeButton } from '@/components/native';

export type LogoutButtonProps = {
  onPress: () => void;
};

export function LogoutButton({ onPress }: LogoutButtonProps) {
  return (
    <NativeButton
      accessibilityLabel="Sair da conta"
      controlSize="regular"
      destructive
      fallbackIcon="log-out-outline"
      label="Sair"
      onPress={onPress}
      systemImage="rectangle.portrait.and.arrow.right"
    />
  );
}
