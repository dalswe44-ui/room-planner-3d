// 미리보기 막대의 확인(✓)·취소(✗) 그림. src/ui/icons.tsx와 같은 방식: 24×24 격자의 선, 색은 currentColor.
import type { ReactNode } from 'react';

function Svg({ size, strokeWidth, children }: { size: number; strokeWidth: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** 확인: 체크 */
export function IconCheck({ size = 22 }: { size?: number }) {
  return (
    <Svg size={size} strokeWidth={2.4}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

/** 취소: 엑스 */
export function IconClose({ size = 22 }: { size?: number }) {
  return (
    <Svg size={size} strokeWidth={1.8}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}
