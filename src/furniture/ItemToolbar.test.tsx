// ItemToolbar와 useSelectedWallDistances를 store에 연결해 확인한다.
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { ItemToolbar } from './ItemToolbar';
import { useItemStatuses } from './useItemStatuses';
import { useSelectedWallDistances } from './useSelectedWallDistances';

const store = () => useProjectStore.getState();
const items = () => store().project.items;
const click = (id: string) => userEvent.setup().click(screen.getByTestId(id));

function addA(patch: Partial<Parameters<ReturnType<typeof store>['addItem']>[0]> = {}) {
  return store().addItem({ name: '책상', kind: 'desk', w: 1000, d: 600, h: 700, color: '#aabbcc', ...patch });
}

beforeEach(() => {
  useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, viewMode: '2d', dragPreview: null, past: [], future: [] });
});
afterEach(cleanup);

describe('ItemToolbar', () => {
  it('선택이 없으면 아무것도 그리지 않는다', () => {
    addA();
    act(() => store().selectItem(null));
    render(<ItemToolbar />);
    expect(screen.queryByTestId('item-toolbar')).toBeNull();
  });

  it('선택하면 toolbar 역할과 이름, 버튼 네 개가 있다', () => {
    addA();
    render(<ItemToolbar />);
    const bar = screen.getByRole('toolbar', { name: '선택한 가구' });
    expect(bar.getAttribute('data-testid')).toBe('item-toolbar');
    for (const id of ['tool-duplicate', 'tool-rotate-left', 'tool-rotate-right', 'tool-delete']) {
      const b = screen.getByTestId(id);
      expect(b.getAttribute('aria-label')).toBeTruthy();
      expect(b.getAttribute('title')).toBe(b.getAttribute('aria-label'));
    }
  });

  it('복제: 같은 속성의 복제본이 겹치지 않게 놓이고 선택된다', async () => {
    const id = addA({ rotationDeg: 90 });
    render(<ItemToolbar />);
    await click('tool-duplicate');
    expect(items()).toHaveLength(2);
    const [orig, copy] = items();
    expect(store().selectedItemId).toBe(copy.id);
    expect(copy.id).not.toBe(id);
    expect(copy).toMatchObject({ name: '책상', kind: 'desk', w: 1000, d: 600, h: 700, color: '#aabbcc', rotationDeg: 90 });
    expect(orig.id).toBe(id);
    const { result } = renderHook(() => useItemStatuses());
    expect(result.current[orig.id]).toEqual({ overlap: false, outside: false, wall: false, door: false });
    expect(result.current[copy.id]).toEqual({ overlap: false, outside: false, wall: false, door: false });
  });

  it('복제본은 방 가운데가 아니라 원본 옆에 놓인다', async () => {
    const id = addA({ x: 600, z: 400 });
    render(<ItemToolbar />);
    await click('tool-duplicate');
    const copy = items()[1];
    expect(Math.abs(copy.x - 600)).toBeLessThanOrEqual(700);
    expect(Math.abs(copy.z - 400)).toBeLessThanOrEqual(700);
    expect(items()[0].id).toBe(id);
  });

  it('되돌리기 한 번에 복제본이 사라진다', async () => {
    addA();
    const before = items().length;
    render(<ItemToolbar />);
    await click('tool-duplicate');
    expect(items()).toHaveLength(before + 1);
    act(() => store().undo());
    expect(items()).toHaveLength(before);
  });

  it('왼쪽은 +90, 오른쪽은 -90(0에서 270)', async () => {
    addA();
    render(<ItemToolbar />);
    await click('tool-rotate-left');
    expect(items()[0].rotationDeg).toBe(90);
    await click('tool-rotate-right');
    expect(items()[0].rotationDeg).toBe(0);
    await click('tool-rotate-right');
    expect(items()[0].rotationDeg).toBe(270);
    expect(items()[0]).toMatchObject({ x: 1800, z: 1500, w: 1000, d: 600 });
  });

  it('삭제는 확인 없이 지우고 막대가 사라진다', async () => {
    addA();
    render(<ItemToolbar />);
    await click('tool-delete');
    expect(items()).toHaveLength(0);
    expect(screen.queryByTestId('item-toolbar')).toBeNull();
  });

  it('막대의 pointerdown은 바깥으로 번지지 않는다', () => {
    addA();
    let seen = false;
    render(
      <div onPointerDown={() => (seen = true)}>
        <ItemToolbar />
      </div>,
    );
    act(() => {
      screen.getByTestId('tool-delete').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(seen).toBe(false);
  });
});

describe('useSelectedWallDistances', () => {
  it('선택이 없으면 null', () => {
    addA();
    act(() => store().selectItem(null));
    expect(renderHook(() => useSelectedWallDistances()).result.current).toBeNull();
  });

  it('1000×600 가구가 가운데에 있으면 1200, 1300, 1200, 1300', () => {
    addA();
    expect(renderHook(() => useSelectedWallDistances()).result.current).toEqual([1200, 1300, 1200, 1300]);
  });

  it('회전하면 폭과 깊이가 바뀐 거리, 끄는 중이면 임시 위치', () => {
    const id = addA();
    const { result } = renderHook(() => useSelectedWallDistances());
    act(() => store().updateItem(id, { rotationDeg: 90 }));
    expect(result.current).toEqual([1000, 1500, 1000, 1500]);
    act(() => store().setDragPreview({ itemId: id, x: 300, z: 1500 }));
    expect(result.current).toEqual([1000, 3000, 1000, 0]);
    act(() => store().setDragPreview(null));
    expect(result.current).toEqual([1000, 1500, 1000, 1500]);
  });

  it('벽 밖으로 나가면 음수', () => {
    addA({ w: 3700, d: 600 });
    expect(renderHook(() => useSelectedWallDistances()).result.current).toEqual([1200, -50, 1200, -50]);
  });
});
