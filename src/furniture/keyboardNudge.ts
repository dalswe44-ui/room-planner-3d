// 선택한 가구(미리보기가 있으면 미리보기)를 방향키로 옮기고, 미리보기는 Enter로 확정, Escape로 취소한다. 자석 맞춤과 격자는 적용하지 않는다(원하는 만큼 정확히 움직이는 것이 목적).
import { useEffect } from 'react';
import type { Mm } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';

/** 방향키 한 번에 옮기는 거리(mm). */
export const NUDGE_MM = 10;
/** Shift를 누른 채 방향키 한 번에 옮기는 거리(mm). */
export const NUDGE_FINE_MM = 1;

/** 방 좌표 기준: → +x, ← -x, ↓ +z, ↑ -z. 방향키가 아니면 null. */
export function nudgeDelta(key: string, shift: boolean): { dx: Mm; dz: Mm } | null {
  const step = shift ? NUDGE_FINE_MM : NUDGE_MM;
  switch (key) {
    case 'ArrowRight':
      return { dx: step, dz: 0 };
    case 'ArrowLeft':
      return { dx: -step, dz: 0 };
    case 'ArrowDown':
      return { dx: 0, dz: step };
    case 'ArrowUp':
      return { dx: 0, dz: -step };
    default:
      return null;
  }
}

/** 글자나 숫자를 입력하는 칸인가. 버튼은 해당하지 않는다. */
function isTextEntry(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el.isContentEditable ||
    el.contentEditable === 'true' // jsdom은 isContentEditable을 구현하지 않는다
  );
}

/** 미리보기가 있을 때 Enter는 확정, Escape는 취소. 입력 칸과 버튼에 포커스가 있으면 무시한다(버튼의 Enter는 그 버튼의 일). */
function handleDraftKey(e: KeyboardEvent): boolean {
  if (e.key !== 'Enter' && e.key !== 'Escape') return false;
  if (isTextEntry(e.target) || e.target instanceof HTMLButtonElement) return false;
  const s = useProjectStore.getState();
  if (!s.draft || s.dragPreview) return false;
  if (e.key === 'Enter') s.commitDraft();
  else s.cancelDraft();
  e.preventDefault();
  return true;
}

/** keydown을 처리한다. 이동했으면 true. */
export function handleNudgeKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (handleDraftKey(e)) return true;
  const delta = nudgeDelta(e.key, e.shiftKey);
  if (!delta) return false;
  if (isTextEntry(e.target)) return false;
  const s = useProjectStore.getState();
  if (s.dragPreview) return false;
  if (s.draft) {
    s.updateDraft({ x: s.draft.x + delta.dx, z: s.draft.z + delta.dz });
    e.preventDefault();
    return true;
  }
  const item = s.project.items.find((it) => it.id === s.selectedItemId);
  if (!item) return false;
  s.updateItem(item.id, { x: item.x + delta.dx, z: item.z + delta.dz });
  e.preventDefault();
  return true;
}

/** App에서 한 번 부른다. 키를 누르고 있으면 keydown이 반복되어 계속 움직인다. */
export function useKeyboardNudge(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleNudgeKey);
    return () => window.removeEventListener('keydown', handleNudgeKey);
  }, []);
}
