// 지금 배치(끄는 중이면 임시 위치 반영)의 가구별 겹침·이탈 상태. 미리보기(draft)는 키 draft.id로 들어가고, 확정 가구의 상태는 미리보기 때문에 바뀌지 않는다.
import { useMemo } from 'react';
import { roomBounds } from '../contracts/room';
import type { ItemStatus } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';
import { computeDraftStatus, computeItemStatuses } from './placement';

export function useItemStatuses(): Record<string, ItemStatus> {
  const items = useProjectStore((s) => s.project.items);
  const corners = useProjectStore((s) => s.project.room.corners);
  const preview = useProjectStore((s) => s.dragPreview);
  const draft = useProjectStore((s) => s.draft);
  return useMemo(() => {
    const room = roomBounds({ corners });
    const result = computeItemStatuses(items, room, preview);
    if (draft) result[draft.id] = computeDraftStatus(draft, items, room, preview);
    return result;
  }, [items, corners, preview, draft]);
}
