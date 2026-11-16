// usePlacement의 핸들러를 실제 store에 연결해 선택·끌기·확정을 확인한다(SPEC P-1 ~ P-4, F-6).
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { createPlacementHandlers, usePlacement } from './usePlacement';

const store = () => useProjectStore.getState();
const itemOf = (id: string) => store().project.items.find((it) => it.id === id)!;

function addA(): string {
  return store().addItem({ name: 'A', w: 1000, d: 600, h: 700 });
}

beforeEach(() => {
  useProjectStore.setState({
    project: createDefaultProject(),
    selectedItemId: null,
    viewMode: '2d',
    dragPreview: null,
  });
});

describe('createPlacementHandlers', () => {
  it('누르면 선택하고, 끄는 동안 dragPreview만 바뀌고, 떼면 스냅해 확정한 뒤 dragPreview를 지운다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    store().selectItem(null);
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    expect(store().selectedItemId).toBe(a);
    h.onFloorPointerMove({ x: 1500, z: 1200 });
    h.onFloorPointerMove({ x: 2456, z: 1994 });
    expect(store().dragPreview).toEqual({ itemId: a, x: 2456, z: 1994 });
    expect(itemOf(a)).toMatchObject({ x: 1800, z: 1500 }); // 확정 전
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 2460, z: 1990, w: 1000, d: 600, rotationDeg: 0 });
    expect(store().dragPreview).toBeNull();
  });

  it('가장자리를 잡고 끌어도 점프하지 않는다(grab offset, P-3)', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    h.onItemPointerDown(a, { x: 2100, z: 1700 });
    h.onFloorPointerMove({ x: 2101, z: 1700 });
    expect(store().dragPreview).toEqual({ itemId: a, x: 1801, z: 1500 });
    h.onFloorPointerMove({ x: 2600, z: 2000 });
    expect(store().dragPreview).toEqual({ itemId: a, x: 2300, z: 1800 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 2300, z: 1800 });
  });

  it('움직이지 않고 떼면 격자에 없던 위치도 그대로다(P-4)', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    store().updateItem(a, { x: 1803, z: 1497 });
    h.onItemPointerDown(a, { x: 1803, z: 1497 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 1803, z: 1497 });
    // 움직였다가 원래 자리로 돌아와 떼도 그대로
    h.onItemPointerDown(a, { x: 1900, z: 1500 });
    h.onFloorPointerMove({ x: 2000, z: 1600 });
    h.onFloorPointerMove({ x: 1900, z: 1500 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 1803, z: 1497 });
    expect(store().dragPreview).toBeNull();
  });

  it('회전 90도 가구는 바뀐 발자국의 왼쪽·위쪽 변을 격자에 맞춘다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    store().updateItem(a, { rotationDeg: 90 });
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 1003, z: 1003 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 1000, z: 1000, rotationDeg: 90 });
  });

  it('3D 뷰에서도 끌 수 있다(2026-11-17 사용자 요청으로 바꿈)', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    store().selectItem(null);
    store().setViewMode('3d');
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    expect(store().selectedItemId).toBe(a);
    h.onFloorPointerMove({ x: 1000, z: 800 });
    expect(store().dragPreview).toMatchObject({ itemId: a, x: 1000, z: 800 });
    h.onPointerUp();
    expect(store().dragPreview).toBeNull();
    expect(itemOf(a)).toMatchObject({ x: 1000, z: 800 });
  });

  it('빈 곳을 누르면 선택을 푼다(F-6)', () => {
    const h = createPlacementHandlers(store);
    addA();
    h.onBackgroundTap();
    expect(store().selectedItemId).toBeNull();
  });

  it('누르지 않은 상태의 이동·떼기는 아무것도 하지 않는다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    h.onFloorPointerMove({ x: 100, z: 100 });
    h.onPointerUp();
    expect(store().dragPreview).toBeNull();
    expect(itemOf(a)).toMatchObject({ x: 1800, z: 1500 });
  });

  it('끄는 중에 가구가 지워지면 떼어도 오류 없이 끝난다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 1000, z: 1000 });
    store().removeItem(a);
    h.onPointerUp();
    expect(store().project.items).toHaveLength(0);
    expect(store().dragPreview).toBeNull();
  });

  it('두 번째 가구를 누르면 그 가구를 끈다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    const b = store().addItem({ name: 'B', w: 1000, d: 1000, h: 500 });
    h.onItemPointerDown(b, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 600, z: 600 });
    h.onPointerUp();
    expect(itemOf(b)).toMatchObject({ x: 600, z: 600 });
    expect(itemOf(a)).toMatchObject({ x: 1800, z: 1500 });
  });
});

describe('usePlacement', () => {
  it('렌더가 바뀌어도 같은 핸들러 객체를 돌려준다', () => {
    const { result, rerender } = renderHook(() => usePlacement());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
