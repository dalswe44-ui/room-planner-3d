// 선택한 가구 위에 장면이 띄우는 도구 막대: 복제, 왼쪽·오른쪽 90도 돌리기, 삭제.
import type { PointerEvent } from 'react';
import { useProjectStore } from '../store/projectStore';
import { IconDuplicate, IconRotateLeft, IconRotateRight, IconTrash } from '../ui/icons';
import { duplicateItem } from './duplicateItem';
import { ROTATE_STEP_DEG } from './placement';
import './furniture.css';

/** 막대를 누르는 일이 장면의 선택 해제나 끌기로 번지지 않게 한다. */
const keepInside = (e: PointerEvent) => e.stopPropagation();

export function ItemToolbar() {
  const selectedItemId = useProjectStore((s) => s.selectedItemId);
  const item = useProjectStore((s) => s.project.items.find((it) => it.id === s.selectedItemId));
  const updateItem = useProjectStore((s) => s.updateItem);
  const removeItem = useProjectStore((s) => s.removeItem);
  if (selectedItemId === null || !item) return null;

  const rotate = (deltaDeg: number) => updateItem(item.id, { rotationDeg: item.rotationDeg + deltaDeg });

  return (
    <div
      className="item-toolbar"
      role="toolbar"
      aria-label="선택한 가구"
      data-testid="item-toolbar"
      onPointerDown={keepInside}
    >
      <button type="button" className="item-toolbar__btn" data-testid="tool-duplicate" aria-label="복제" title="복제" onClick={() => duplicateItem(item)}>
        <IconDuplicate />
      </button>
      <button
        type="button"
        className="item-toolbar__btn"
        data-testid="tool-rotate-left"
        aria-label="왼쪽으로 90° 돌리기"
        title="왼쪽으로 90° 돌리기"
        onClick={() => rotate(ROTATE_STEP_DEG)}
      >
        <IconRotateLeft />
      </button>
      <button
        type="button"
        className="item-toolbar__btn"
        data-testid="tool-rotate-right"
        aria-label="오른쪽으로 90° 돌리기"
        title="오른쪽으로 90° 돌리기"
        onClick={() => rotate(-ROTATE_STEP_DEG)}
      >
        <IconRotateRight />
      </button>
      <button
        type="button"
        className="item-toolbar__btn item-toolbar__btn--danger"
        data-testid="tool-delete"
        aria-label="삭제"
        title="삭제"
        onClick={() => removeItem(item.id)}
      >
        <IconTrash />
      </button>
    </div>
  );
}
