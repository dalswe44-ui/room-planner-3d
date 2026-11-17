// 앱에서 쓰는 그림 기호. 24×24 격자에 선으로 직접 그렸다(외부 아이콘 묶음 없음). 색은 currentColor.
// 그림만 있는 버튼에는 버튼 쪽에 aria-label을 붙이고, 그림은 aria-hidden으로 둔다.
import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
}

function Svg({ size = 22, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** 복제: 겹친 두 장 */
export function IconDuplicate(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h.5" />
    </Svg>
  );
}

/** 왼쪽으로(반시계) 돌리기 */
export function IconRotateLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12a7 7 0 1 0 2.4-5.3" />
      <path d="M4 4.5V8h3.5" />
    </Svg>
  );
}

/** 오른쪽으로(시계) 돌리기 */
export function IconRotateRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 12a7 7 0 1 1-2.4-5.3" />
      <path d="M20 4.5V8h-3.5" />
    </Svg>
  );
}

/** 삭제: 휴지통 */
export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7l.8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10.2 11v5M13.8 11v5" />
    </Svg>
  );
}

/** 되돌리기 */
export function IconUndo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8.5 14 4 9.5 8.5 5" />
      <path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
    </Svg>
  );
}

/** 다시 실행 */
export function IconRedo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15.5 14 20 9.5 15.5 5" />
      <path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3" />
    </Svg>
  );
}

/** 더하기 */
export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** 앱 표지: 방 평면과 가구 하나 */
export function IconPlan(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4h16v16H4z" />
      <path d="M4 14h5" />
      <rect x="12.5" y="7.5" width="4.5" height="6" rx="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}
