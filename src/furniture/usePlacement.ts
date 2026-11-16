// 장면의 포인터 이벤트(PlacementHandlers)를 받아 선택, 끌기, 확정을 처리한다.
import { useState } from 'react';
import type { PlacementHandlers, PointMm } from '../contracts/types';
import { useProjectStore, type ProjectState } from '../store/projectStore';
import { dragCenter, grabOffset, snapCenter } from './placement';

/**
 * store 상태를 읽는 함수를 받아 핸들러를 만든다. 끄는 중인 가구와 grab offset은 이 클로저에만 둔다.
 * - 가구를 누르면 선택한다. 3D 뷰에서는 선택만 하고 끌지 않는다(docs/DECISIONS.md).
 * - 끄는 동안의 위치는 setDragPreview로만 넘기고, 손을 뗄 때 스냅해서 updateItem으로 한 번 확정한다.
 * - 움직이지 않고 떼면(임시 위치가 없거나 원래 위치와 같으면) 그대로 둔다.
 */
export function createPlacementHandlers(getState: () => ProjectState): PlacementHandlers {
  let drag: { itemId: string; offset: PointMm } | null = null;

  return {
    onItemPointerDown(itemId, floor) {
      const s = getState();
      s.selectItem(itemId);
      drag = null;
      const item = s.project.items.find((it) => it.id === itemId);
      if (!item) return;
      drag = { itemId, offset: grabOffset({ x: item.x, z: item.z }, floor) };
    },

    onFloorPointerMove(floor) {
      if (!drag) return;
      const at = dragCenter(floor, drag.offset);
      getState().setDragPreview({ itemId: drag.itemId, x: at.x, z: at.z });
    },

    onPointerUp() {
      if (!drag) return;
      const { itemId } = drag;
      drag = null;
      const s = getState();
      const preview = s.dragPreview;
      const item = s.project.items.find((it) => it.id === itemId);
      if (item && preview && preview.itemId === itemId && (preview.x !== item.x || preview.z !== item.z)) {
        s.updateItem(itemId, snapCenter(item, preview));
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
