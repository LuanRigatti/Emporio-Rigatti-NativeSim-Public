import { useId } from 'react';

import NativeLiquidGlassView from './NativeLiquidGlassView';

export type NativeGlassShape = 'capsule' | 'circle' | 'roundedRectangle';
export type NativeLiquidGlassMode = 'transition' | 'morphButton' | 'actionGroup';
export type NativeLiquidGlassState = 'collapsed' | 'expanded' | string;

export type NativeGlassAction = {
  id: string;
  systemImage: string;
  title?: string;
  accessibilityLabel?: string;
  shape?: NativeGlassShape;
  width?: number;
  height?: number;
  tint?: string;
  disabled?: boolean;
  visible?: boolean;
};

export type NativeLiquidGlassActionPressEvent = {
  nativeEvent: {
    id: string;
  };
};

export type NativeLiquidGlassViewProps = {
  mode: NativeLiquidGlassMode;
  state?: NativeLiquidGlassState;
  glassIdentity?: string;
  unionID?: string;
  spacing?: number;
  animationDuration?: number;
  animationBounce?: number;
  accessibilityLabel?: string;
  tint?: string;
  actions?: NativeGlassAction[];
  collapsedActionIDs?: string[];
  expandedActionIDs?: string[];
  collapsedSystemImage?: string;
  expandedSystemImage?: string;
  collapsedTitle?: string;
  expandedTitle?: string;
  collapsedShape?: NativeGlassShape;
  expandedShape?: NativeGlassShape;
  onActionPress?: (event: NativeLiquidGlassActionPressEvent) => void;
};

function useStableIdentity(prefix: string, identity?: string): string {
  const reactID = useId().replaceAll(':', '-');
  return identity ?? `${prefix}-${reactID}`;
}

export type NativeLiquidGlassTransitionProps = Omit<
  NativeLiquidGlassViewProps,
  | 'mode'
  | 'collapsedSystemImage'
  | 'expandedSystemImage'
  | 'collapsedTitle'
  | 'expandedTitle'
  | 'collapsedShape'
  | 'expandedShape'
> & {
  actions: NativeGlassAction[];
};

export function NativeLiquidGlassTransition({
  glassIdentity,
  ...props
}: NativeLiquidGlassTransitionProps) {
  const identity = useStableIdentity('liquid-glass-transition', glassIdentity);

  return <NativeLiquidGlassView {...props} mode="transition" glassIdentity={identity} />;
}

export type NativeGlassMorphButtonProps = Omit<
  NativeLiquidGlassViewProps,
  'mode' | 'actions' | 'collapsedActionIDs' | 'expandedActionIDs'
>;

export function NativeGlassMorphButton({ glassIdentity, ...props }: NativeGlassMorphButtonProps) {
  const identity = useStableIdentity('glass-morph-button', glassIdentity);

  return <NativeLiquidGlassView {...props} mode="morphButton" glassIdentity={identity} />;
}

export type NativeGlassActionGroupProps = Omit<
  NativeLiquidGlassViewProps,
  | 'mode'
  | 'collapsedSystemImage'
  | 'expandedSystemImage'
  | 'collapsedTitle'
  | 'expandedTitle'
  | 'collapsedShape'
  | 'expandedShape'
> & {
  actions: NativeGlassAction[];
};

export function NativeGlassActionGroup({
  glassIdentity,
  unionID,
  ...props
}: NativeGlassActionGroupProps) {
  const identity = useStableIdentity('glass-action-group', glassIdentity);
  const union = useStableIdentity('glass-union', unionID);

  return (
    <NativeLiquidGlassView {...props} mode="actionGroup" glassIdentity={identity} unionID={union} />
  );
}
