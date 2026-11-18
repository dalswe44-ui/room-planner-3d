// 2026-11-19 QA 4-6(Delete·Escape), 5-6(여러 가구 함께 고르기·옮기기)
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { useKeyboardNudge } from './keyboardNudge';
import { createPlacementHandlers } from './usePlacement';

const store = () => useProjectStore.getState();
const key = (k: string, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

let unmount: () => void;
let a: string;
let b: string;
let c: string;
beforeEach(() => {
  useProjectStore.setState({ ...useProjectStore.getInitialState(), project: createDefaultProject(), past: [], future: [] });
  a = store().addItem({ name: 'A', w: 400, d: 400, h: 700, x: 500, z: 500 });
  b = store().addItem({ name: 'B', w: 400, d: 400, h: 700, x: 1500, z: 500 });
  c = store().addItem({ name: 'C', w: 400, d: 400, h: 700, x: 2500, z: 500 });
  unmount = renderHook(() => useKeyboardNudge()).unmount;
});
afterEach(() => unmount());

describe('Delete·Backspace·Escape', () => {
  it('Delete는 선택한 가구를 지우고 되돌리기 한 번에 돌아온다', () => {
    store().selectItem(a);
    key('Delete');
    expect(store().project.items.map((i) => i.id)).toEqual([b, c]);
    expect(store().selectedItemId).toBeNull();
    store().undo();
    expect(store().project.items).toHaveLength(3);
  });
  it('Backspace도 지운다. 입력 칸에 포커스가 있으면 지우지 않는다', () => {
    store().selectItem(b);
    const input = document.createElement('input');
    document.body.appendChild(input);
    key('Backspace', input);
    expect(store().project.items).toHaveLength(3);
    key('Backspace');
    expect(store().project.items).toHaveLength(2);
    input.remove();
  });
  it('Escape는 선택을 푼다', () => {
    store().selectItem(a);
    key('Escape');
    expect(store().selectedItemId).toBeNull();
    expect(store().project.items).toHaveLength(3);
  });
});

describe('여러 가구 함께 고르기', () => {
  it('toggleItemSelection으로 더하고 빼고, Delete는 함께 지운다(되돌리기 한 단계)', () => {
    store().selectItem(a);
    store().toggleItemSelection(b);
    store().toggleItemSelection(c);
    expect([store().selectedItemId, ...store().extraSelectedIds]).toEqual([a, b, c]);
    store().toggleItemSelection(b);
    expect(store().extraSelectedIds).toEqual([c]);
    const past = store().past.length;
    key('Delete');
    expect(store().project.items.map((i) => i.id)).toEqual([b]);
    expect(store().past.length).toBe(past + 1);
    expect(store().selectedItemId).toBeNull();
  });
  it('방향키는 함께 고른 가구를 모두 옮긴다', () => {
    store().selectItem(a);
    store().toggleItemSelection(c);
    key('ArrowRight');
    key('ArrowDown');
    const pos = Object.fromEntries(store().project.items.map((i) => [i.id, [i.x, i.z]]));
    expect(pos[a]).toEqual([510, 510]);
    expect(pos[c]).toEqual([2510, 510]);
    expect(pos[b]).toEqual([1500, 500]);
  });
  it('묶음 중 하나를 끌면 모두 같은 거리만큼 옮겨지고 한 단계로 기록된다', () => {
    store().selectItem(a);
    store().toggleItemSelection(b);
    const h = createPlacementHandlers(useProjectStore.getState);
    const past = store().past.length;
    h.onItemPointerDown(b, { x: 1500, z: 500 });
    h.onFloorPointerMove({ x: 1800, z: 1300 });
    h.onPointerUp();
    const it = (id: string) => store().project.items.find((i) => i.id === id)!;
    const dx = it(b).x - 1500;
    const dz = it(b).z - 500;
    expect(dx).not.toBe(0);
    expect([it(a).x - 500, it(a).z - 500]).toEqual([dx, dz]);
    expect([it(c).x, it(c).z]).toEqual([2500, 500]);
    expect(store().past.length).toBe(past + 1);
    expect([store().selectedItemId, ...store().extraSelectedIds]).toEqual([a, b]);
  });
  it('Shift로 누르면(additive) 끌지 않고 선택에 더한다', () => {
    store().selectItem(a);
    const h = createPlacementHandlers(useProjectStore.getState);
    h.onItemPointerDown(c, { x: 2500, z: 500 }, true);
    h.onFloorPointerMove({ x: 2900, z: 900 });
    h.onPointerUp();
    expect(store().extraSelectedIds).toEqual([c]);
    expect(store().project.items.find((i) => i.id === c)!.x).toBe(2500);
  });
});
