// 선택한 가구(미리보기가 있으면 미리보기)에서 네 방향 가장 가까운 벽(바깥 벽 또는 칸막이 벽)까지의 거리. 끄는 중이면 임시 위치로 잰다. 패널과 장면의 치수선이 같은 값을 쓴다.
import { useMemo } from 'react';
import { roomBounds } from '../contracts/room';
import type { Mm } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';
import { currentFootprint, wallDistances, wallRects } from './placement';

export function useSelectedWallDistances(): readonly [Mm, Mm, Mm, Mm] | null {
  const items = useProjectStore((s) => s.project.items);
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const draft = useProjectStore((s) => s.draft);
  const corners = useProjectStore((s) => s.project.room.corners);
  const walls = useProjectStore((s) => s.project.room.walls);
  const preview = useProjectStore((s) => s.dragPreview);
  return useMemo(() => {
    const item = draft ?? items.find((it) => it.id === selectedItemId);
    return item ? wallDistances(currentFootprint(item, preview), roomBounds({ corners }), wallRects({ walls })) : null;
  }, [items, selectedItemId, draft, corners, walls, preview]);
}
