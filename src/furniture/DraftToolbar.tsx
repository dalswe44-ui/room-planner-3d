// 미리보기 가구 위에 장면이 띄우는 도구 막대: ✗ 취소, 왼쪽·오른쪽 90도 돌리기, ✓ 추가.
import type { PointerEvent } from 'react';
import { useProjectStore } from '../store/projectStore';
import { IconRotateLeft, IconRotateRight } from '../ui/icons';
import { IconCheck, IconClose } from './DraftIcons';
import { ROTATE_STEP_DEG } from './placement';
import './furniture.css';

/** 막대를 누르는 일이 장면의 선택 해제나 끌기로 번지지 않게 한다. */
const keepInside = (e: PointerEvent) => e.stopPropagation();

export function DraftToolbar() {
  const draft = useProjectStore((s) => s.draft);
  const updateDraft = useProjectStore((s) => s.updateDraft);
  const commitDraft = useProjectStore((s) => s.commitDraft);
  const cancelDraft = useProjectStore((s) => s.cancelDraft);
  if (!draft) return null;

  const rotate = (deltaDeg: number) => updateDraft({ rotationDeg: draft.rotationDeg + deltaDeg });

  return (
    <div className="item-toolbar" role="toolbar" aria-label="미리보기 가구" data-testid="draft-toolbar" onPointerDown={keepInside}>
      <button type="button" className="item-toolbar__btn" data-testid="draft-cancel" aria-label="취소" title="취소" onClick={cancelDraft}>
        <IconClose />
      </button>
      <button
        type="button"
        className="item-toolbar__btn"
        data-testid="draft-rotate-left"
        aria-label="왼쪽으로 90° 돌리기"
        title="왼쪽으로 90° 돌리기"
        onClick={() => rotate(ROTATE_STEP_DEG)}
      >
        <IconRotateLeft />
      </button>
      <button
        type="button"
        className="item-toolbar__btn"
        data-testid="draft-rotate-right"
        aria-label="오른쪽으로 90° 돌리기"
        title="오른쪽으로 90° 돌리기"
        onClick={() => rotate(-ROTATE_STEP_DEG)}
      >
        <IconRotateRight />
      </button>
      <button
        type="button"
        className="item-toolbar__btn item-toolbar__btn--confirm"
        data-testid="draft-confirm"
        aria-label="추가"
        title="추가"
        onClick={() => commitDraft()}
      >
        <IconCheck />
      </button>
    </div>
  );
}
