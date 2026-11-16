// 지금 배치(끄는 중이면 임시 위치 반영)의 가구별 겹침·이탈 상태.
import { useMemo } from 'react';
import { roomBounds } from '../contracts/room';
import type { ItemStatus } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';
import { computeItemStatuses } from './placement';

export function useItemStatuses(): Record<string, ItemStatus> {
  const items = useProjectStore((s) => s.project.items);
  const corners = useProjectStore((s) => s.project.room.corners);
  const preview = useProjectStore((s) => s.dragPreview);
  return useMemo(() => computeItemStatuses(items, roomBounds({ corners }), preview), [items, corners, preview]);
}
