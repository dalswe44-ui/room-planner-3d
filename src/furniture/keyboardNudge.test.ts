import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { nudgeDelta, useKeyboardNudge } from './keyboardNudge';

const store = () => useProjectStore.getState();

describe('nudgeDelta', () => {
  it('방 좌표 기준 방향과 10 mm / Shift 1 mm', () => {
    expect(nudgeDelta('ArrowRight', false)).toEqual({ dx: 10, dz: 0 });
    expect(nudgeDelta('ArrowLeft', false)).toEqual({ dx: -10, dz: 0 });
    expect(nudgeDelta('ArrowDown', false)).toEqual({ dx: 0, dz: 10 });
    expect(nudgeDelta('ArrowUp', false)).toEqual({ dx: 0, dz: -10 });
    expect(nudgeDelta('ArrowRight', true)).toEqual({ dx: 1, dz: 0 });
    expect(nudgeDelta('ArrowUp', true)).toEqual({ dx: 0, dz: -1 });
  });
  it('방향키가 아니면 null', () => {
    expect(nudgeDelta('a', false)).toBeNull();
    expect(nudgeDelta('Enter', true)).toBeNull();
  });
});

describe('useKeyboardNudge', () => {
  let unmount: () => void;
  let id: string;
  beforeEach(() => {
    useProjectStore.setState({ project: createDefaultProject(), selectedItemId: null, viewMode: '2d', dragPreview: null });
    id = store().addItem({ name: 'A', w: 1000, d: 600, h: 700 }); // 중심 (1800, 1500), 선택됨
    unmount = renderHook(() => useKeyboardNudge()).unmount;
  });
  afterEach(() => {
    unmount();
    document.body.innerHTML = '';
  });
  const pos = () => {
    const it = store().project.items.find((i) => i.id === id)!;
    return { x: it.x, z: it.z };
  };
  const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
  };

  it('방향키로 10 mm씩 움직이고 preventDefault 한다', () => {
    const e = press('ArrowRight');
    press('ArrowRight');
    press('ArrowRight');
    expect(pos()).toEqual({ x: 1830, z: 1500 });
    expect(e.defaultPrevented).toBe(true);
  });

  it('Shift면 1 mm씩', () => {
    press('ArrowDown', { shiftKey: true });
    press('ArrowDown', { shiftKey: true });
    expect(pos()).toEqual({ x: 1800, z: 1502 });
  });

  it('격자·자석 없이 벽 밖으로도 나간다', () => {
    for (let i = 0; i < 135; i++) press('ArrowLeft'); // 중심 x 1800 - 1350 = 450, 왼쪽 변 -50
    expect(pos().x).toBe(450);
    press('ArrowLeft', { shiftKey: true });
    expect(pos().x).toBe(449);
  });

  it('입력 칸·select·textarea에 포커스가 있으면 무시하고 preventDefault 하지 않는다', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.body.appendChild(document.createElement(tag));
      const e = press('ArrowLeft', {}, el);
      expect(e.defaultPrevented).toBe(false);
    }
    const div = document.body.appendChild(document.createElement('div'));
    div.contentEditable = 'true';
    press('ArrowLeft', {}, div);
    expect(pos()).toEqual({ x: 1800, z: 1500 });
  });

  it('버튼에 포커스가 있으면 움직인다', () => {
    const b = document.body.appendChild(document.createElement('button'));
    press('ArrowUp', {}, b);
    expect(pos()).toEqual({ x: 1800, z: 1490 });
  });

  it('선택이 없으면 무시하고 preventDefault 하지 않는다', () => {
    store().selectItem(null);
    const e = press('ArrowRight');
    expect(pos().x).toBe(1800);
    expect(e.defaultPrevented).toBe(false);
  });

  it('끄는 중(dragPreview)에는 무시', () => {
    store().setDragPreview({ itemId: id, x: 1900, z: 1500 });
    press('ArrowRight');
    expect(pos().x).toBe(1800);
  });

  it('Ctrl/Alt/Meta와 함께면 무시, 방향키가 아니면 무시', () => {
    press('ArrowRight', { ctrlKey: true });
    press('ArrowRight', { altKey: true });
    press('a');
    expect(pos()).toEqual({ x: 1800, z: 1500 });
  });

  it('언마운트하면 더는 움직이지 않는다', () => {
    unmount();
    press('ArrowRight');
    expect(pos().x).toBe(1800);
    unmount = renderHook(() => useKeyboardNudge()).unmount;
  });
});
