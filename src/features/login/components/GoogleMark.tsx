import Svg, { Path } from 'react-native-svg';

export type GoogleMarkProps = {
  size?: number;
};

export function GoogleMark({ size = 20 }: GoogleMarkProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no"
      viewBox="0 0 24 24"
      width={size}
    >
      <Path
        d="M21.35 12.27c0-.77-.07-1.51-.2-2.22H12v4.2h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.22 2.91-7.37Z"
        fill="#4285F4"
      />
      <Path
        d="M12 21.85c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.85Z"
        fill="#34A853"
      />
      <Path
        d="M6.54 13.93a5.85 5.85 0 0 1 0-3.86V7.54H3.3a9.74 9.74 0 0 0 0 8.92l3.24-2.53Z"
        fill="#FBBC05"
      />
      <Path
        d="M12 6.04c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.12 14.63 2.15 12 2.15a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.76 9.46 6.04 12 6.04Z"
        fill="#EA4335"
      />
    </Svg>
  );
}
