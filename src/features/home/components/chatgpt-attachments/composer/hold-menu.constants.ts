export const HOLD_MENU_LAYOUT = {
  maxTiles: 4,
  maxTileSize: 104,
  tileGap: 8,
  tileRadius: 18,
  trayInset: 20,
  trayOffset: 14,
  hoverSlopY: 18,
  iconSize: 24,
  stackOffset: 4,
  startScale: 0.3,
  startRotation: -10,
  rotationStep: 7,
  hoverScale: 1.1,
  tileBlurRadius: 12,
  stackScale: 0.8,
  dismissScale: 0.9,
  trailArc: 30,
  trailFade: 0.35,
  trailBlur: 4.6,
  backdropIntensity: 25,
  bandFade: 96,
  seamFade: 36,
  iconRotation: 45,
} as const;

export const HOLD_MENU_GESTURE = {
  holdDuration: 280,
  buttonHitSlop: 12,
} as const;

export const HOLD_MENU_ANIMATION = {
  openSpring: { duration: 420, dampingRatio: 0.95 },
  closeSpring: { duration: 520, dampingRatio: 1 },
  tileMoveSpring: { duration: 460, dampingRatio: 0.92 },
  tileLiftSpring: { duration: 420, dampingRatio: 0.9 },
  tileCloseSpring: { duration: 400, dampingRatio: 1 },
  hoverSpring: { duration: 240, dampingRatio: 0.9 },
  spreadDelay: 40,
  openStagger: 20,
  collapseDelay: 70,
  closeStagger: 16,
  settled: 0.001,
} as const;

export const HOLD_MENU_DOCK = {
  duration: 440,
} as const;

export const HOLD_MENU_PALETTE = {
  dark: {
    wash: 'rgba(0, 0, 0, 0.45)',
    seam: 'rgba(22, 22, 22, 0)',
    seamSoft: 'rgba(22, 22, 22, 0.35)',
    seamMid: 'rgba(22, 22, 22, 0.75)',
    seamPeak: 'rgba(22, 22, 22, 0.92)',
    tileBackground: '#1C1C1E',
    tileBorder: 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    wash: 'rgba(255, 255, 255, 0.5)',
    seam: 'rgba(246, 246, 246, 0)',
    seamSoft: 'rgba(246, 246, 246, 0.35)',
    seamMid: 'rgba(246, 246, 246, 0.75)',
    seamPeak: 'rgba(246, 246, 246, 0.92)',
    tileBackground: '#F2F2F7',
    tileBorder: 'rgba(0, 0, 0, 0.06)',
  },
} as const;
