// 선택한 가구(또는 미리보기)의 경고를 화면 낭독기에 읽어 주는 영역(2026-11-19 QA 4-10).
// 경고 문구(item-status)는 경고가 있을 때만 생기므로 낭독기가 놓친다. 이 영역은 늘 있고 글자만 바뀐다.
import type { ItemStatus } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';

export function warningWords(st: ItemStatus | undefined): string[] {
  if (!st) return [];
  return [
    st.overlap && '다른 가구와 겹침',
    st.outside && '방 밖',
    st.wall && '칸막이 벽과 겹침',
    st.door && '문이 열리는 자리',
  ].filter((w): w is string => typeof w === 'string');
}

export function WarningLive({ statuses }: { statuses: Record<string, ItemStatus> }) {
  const target = useProjectStore((s) => s.draft ?? s.project.items.find((it) => it.id === s.selectedItemId) ?? null);
  const ceiling = useProjectStore((s) => s.project.room.ceilingHeight);
  let text = '';
  if (target) {
    const words = warningWords(statuses[target.id]);
    if (target.h + target.elevation > ceiling) words.push('천장보다 높음');
    text = words.length > 0 ? `${target.name} 경고: ${words.join(', ')}` : '';
  }
  return (
    <p className="sr-only" aria-live="polite" data-testid="warning-live">
      {text}
    </p>
  );
}
