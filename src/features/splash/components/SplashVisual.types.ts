export type SplashVisualProps = {
  colorScheme: 'light' | 'dark';
  startReveal: boolean;
  reduceMotion: boolean;
  onOverlayReady: () => void;
  onAnimationComplete: () => void;
};
