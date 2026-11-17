// DraftToolbar와 방향키·Enter·Escape가 미리보기(draft)에 하는 일.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { DraftToolbar } from './DraftToolbar';
import { handleNudgeKey } from './keyboardNudge';

const store = () => useProjectStore.getState();
const byId = (id: string) => screen.getByTestId(id);

function key(k: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'target', { value: target });
  return handleNudgeKey(e);
}

beforeEach(() => {
  useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, viewMode: '2d', dragPreview: null, draft: null });
});
afterEach(cleanup);

describe('DraftToolbar', () => {
  it('draft가 없으면 그리지 않는다', () => {
    render(<DraftToolbar />);
    expect(screen.queryByTestId('draft-toolbar')).toBeNull();
  });

  it('버튼 4개에 aria-label, ✓는 확정, ✗는 취소, 회전은 90도', async () => {
    store().startDraft({ name: 'A', w: 1000, d: 600, h: 700 });
    render(<DraftToolbar />);
    for (const id of ['draft-confirm', 'draft-rotate-left', 'draft-rotate-right', 'draft-cancel']) {
      expect(byId(id).getAttribute('aria-label')).toBeTruthy();
    }
    const user = userEvent.setup();
    await user.click(byId('draft-rotate-left'));
    expect(store().draft!.rotationDeg).toBe(90);
    await user.click(byId('draft-rotate-right'));
    await user.click(byId('draft-rotate-right'));
    expect(store().draft!.rotationDeg).toBe(270); // store가 0~359로 정규화한다
    await user.click(byId('draft-confirm'));
    expect(store().project.items).toHaveLength(1);
    expect(store().project.items[0].rotationDeg).toBe(270);
    expect(store().selectedItemId).toBe(store().project.items[0].id);
    expect(screen.queryByTestId('draft-toolbar')).toBeNull();
  });

  it('✗는 items를 만들지 않고 draft를 지운다', async () => {
    store().startDraft({ name: 'A', w: 1000, d: 600, h: 700 });
    render(<DraftToolbar />);
    await userEvent.setup().click(byId('draft-cancel'));
    expect(store().draft).toBeNull();
    expect(store().project.items).toHaveLength(0);
  });

  it('pointerdown이 막대 밖으로 번지지 않는다', () => {
    store().startDraft({ name: 'A', w: 1000, d: 600, h: 700 });
    let reached = false;
    render(
      <div onPointerDown={() => (reached = true)}>
        <DraftToolbar />
      </div>,
    );
    fireEvent.pointerDown(byId('draft-confirm'));
    expect(reached).toBe(false);
  });
});

describe('draft 키보드', () => {
  it('방향키는 draft를 10 mm, Shift는 1 mm 옮긴다', () => {
    store().startDraft({ name: 'A', w: 1000, d: 600, h: 700, x: 1800, z: 1500 });
    expect(key('ArrowRight')).toBe(true);
    expect(key('ArrowDown', document.body, { shiftKey: true })).toBe(true);
    expect(store().draft).toMatchObject({ x: 1810, z: 1501 });
  });

  it('Enter는 확정, Escape는 취소', () => {
    store().startDraft({ name: 'A', w: 1000, d: 600, h: 700 });
    expect(key('Enter')).toBe(true);
    expect(store().project.items).toHaveLength(1);
    expect(store().draft).toBeNull();
    store().startDraft({ name: 'B', w: 1000, d: 600, h: 700 });
    expect(key('Escape')).toBe(true);
    expect(store().draft).toBeNull();
    expect(store().project.items).toHaveLength(1);
  });

  it('입력 칸에 포커스가 있으면 Enter·Escape·방향키를, 다른 버튼이면 Enter를 무시한다', () => {
    store().startDraft({ name: 'A', w: 1000, d: 600, h: 700, x: 1800, z: 1500 });
    const input = document.createElement('input');
    const button = document.createElement('button');
    expect(key('Enter', input)).toBe(false);
    expect(key('Escape', input)).toBe(false);
    expect(key('ArrowLeft', input)).toBe(false);
    expect(key('Enter', button)).toBe(false);
    expect(store().draft).toMatchObject({ x: 1800, z: 1500 });
    expect(store().project.items).toHaveLength(0);
  });

  it('가구 칩을 누른 직후(칩에 포커스): Escape는 취소, Enter는 확정 (결함 1)', () => {
    const chip = document.createElement('button');
    chip.dataset.testid = 'preset-bed';
    const other = document.createElement('button');
    store().startDraft({ name: 'A', w: 1000, d: 600, h: 700 });
    expect(key('Escape', other)).toBe(true);
    expect(store().draft).toBeNull();
    store().startDraft({ name: 'B', w: 1000, d: 600, h: 700 });
    expect(key('Escape', chip)).toBe(true);
    expect(store().draft).toBeNull();
    store().startDraft({ name: 'C', w: 1000, d: 600, h: 700 });
    expect(key('Enter', chip)).toBe(true);
    expect(store().project.items).toHaveLength(1);
    expect(store().draft).toBeNull();
  });

  it('draft가 없으면 Enter·Escape는 아무 일도 하지 않는다', () => {
    expect(key('Enter')).toBe(false);
    expect(key('Escape')).toBe(false);
  });

  it('끄는 중에는 Enter·Escape를 무시한다', () => {
    const id = store().startDraft({ name: 'A', w: 1000, d: 600, h: 700 });
    act(() => store().setDragPreview({ itemId: id, x: 1, z: 1 }));
    expect(key('Enter')).toBe(false);
    expect(store().draft).not.toBeNull();
  });
});
