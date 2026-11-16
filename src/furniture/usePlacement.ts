// 장면의 포인터 이벤트(PlacementHandlers)를 받아 선택, 끌기, 확정을 처리한다.
import { useState } from 'react';
import type { PlacementHandlers, PointMm } from '../contracts/types';
import { useProjectStore, type ProjectState } from '../store/projectStore';
import { roomBounds } from '../contracts/room';
import { dragCenter, footprint, grabOffset, settleCenter, snapToEdges, type Footprint } from './placement';

/**
 * store 상태를 읽는 함수를 받아 핸들러를 만든다. 끄는 중인 가구와 grab offset은 이 클로저에만 둔다.
 * - 가구를 누르면 선택한다. 평면·3D 뷰 모두 끌 수 있다(docs/DECISIONS.md 2026-11-17).
 * - 끄는 동안의 위치는 setDragPreview로만 넘긴다. 벽·다른 가구에 SNAP_MM 이내로 다가오면 임시 위치에도 맞닿게 반영한다.
 *   격자는 손을 뗄 때만 적용한다(끄는 중 10 mm씩 튀지 않게). 붙은 축은 격자 없이 확정한다.
 * - 움직이지 않고 떼면(임시 위치가 없거나 원래 위치와 같으면) 그대로 둔다.
 */
function othersOf(s: ProjectState, itemId: string): Footprint[] {
  return s.project.items.filter((it) => it.id !== itemId).map((it) => footprint(it));
}

export function createPlacementHandlers(getState: () => ProjectState): PlacementHandlers {
  let drag: { itemId: string; offset: PointMm; raw: PointMm | null } | null = null;

  return {
    onItemPointerDown(itemId, floor) {
      const s = getState();
      s.selectItem(itemId);
      drag = null;
      const item = s.project.items.find((it) => it.id === itemId);
      if (!item) return;
      drag = { itemId, offset: grabOffset({ x: item.x, z: item.z }, floor), raw: null };
    },

    onFloorPointerMove(floor) {
      if (!drag) return;
      const s = getState();
      const item = s.project.items.find((it) => it.id === drag!.itemId);
      if (!item) return;
      const raw = dragCenter(floor, drag.offset);
      drag.raw = raw; // 확정은 자석 맞춤 전의 포인터 위치에서 다시 계산한다
      const at = snapToEdges(item, raw, roomBounds(s.project.room), othersOf(s, item.id));
      s.setDragPreview({ itemId: drag.itemId, x: at.x, z: at.z });
    },

    onPointerUp() {
      if (!drag) return;
      const { itemId, raw } = drag;
      drag = null;
      const s = getState();
      const preview = s.dragPreview;
      const item = s.project.items.find((it) => it.id === itemId);
      if (item && preview && preview.itemId === itemId && (preview.x !== item.x || preview.z !== item.z)) {
        s.updateItem(itemId, settleCenter(item, raw ?? preview, roomBounds(s.project.room), othersOf(s, itemId)));
      }
      if (preview) s.setDragPreview(null);
    },

    onBackgroundTap() {
      getState().selectItem(null);
    },
  };
}

export function usePlacement(): PlacementHandlers {
  const [handlers] = useState(() => createPlacementHandlers(useProjectStore.getState));
  return handlers;
}
