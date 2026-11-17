// usePlacement의 핸들러를 실제 store에 연결해 선택·끌기·확정을 확인한다(SPEC P-1 ~ P-4, F-6).
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { computeItemStatuses, SNAP_MM } from './placement';
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
    draft: null,
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

  it('끄는 동안 dragPreview에 자석 맞춤이 반영되고 놓으면 벽에 딱 붙는다', () => {
    const h = createPlacementHandlers(store);
    const a = addA(); // 1000 x 600
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 500 + SNAP_MM - 5, z: 1500 }); // 왼쪽 변 SNAP_MM - 5
    expect(store().dragPreview).toEqual({ itemId: a, x: 500, z: 1500 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 500, z: 1500 });
  });

  it('다른 가구 SNAP_MM - 5 옆까지 끌면 맞닿고 경고가 없다, SNAP_MM + 10 이면 붙지 않는다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    store().updateItem(a, { x: 1000, z: 1500 }); // x 500 ~ 1500
    const b = store().addItem({ name: 'B', w: 1000, d: 600, h: 500 });
    h.onItemPointerDown(b, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 2580, z: 1500 }); // 왼쪽 변 2080 이므로 오른쪽 변 1500에서 580: 멀다
    h.onFloorPointerMove({ x: 2000 + SNAP_MM - 5, z: 1500 }); // 간격 SNAP_MM - 5
    expect(store().dragPreview).toEqual({ itemId: b, x: 2000, z: 1500 });
    h.onPointerUp();
    expect(itemOf(b)).toMatchObject({ x: 2000, z: 1500 });
    h.onItemPointerDown(b, { x: 2000, z: 1500 });
    h.onFloorPointerMove({ x: 2000 + SNAP_MM + 10, z: 1500 }); // 간격 SNAP_MM + 10
    h.onPointerUp();
    expect(itemOf(b)).toMatchObject({ x: 2000 + SNAP_MM + 10, z: 1500 });
  });

  it('끄는 가구 자신은 후보가 아니고, 맞닿은 뒤 겹침 경고가 없다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    const b = store().addItem({ name: 'B', w: 1000, d: 600, h: 500 });
    store().updateItem(a, { x: 600, z: 1500 });
    h.onItemPointerDown(b, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 1600 + SNAP_MM - 5, z: 1500 }); // a 오른쪽 1100과 간격 SNAP_MM - 5
    h.onPointerUp();
    expect(itemOf(b)).toMatchObject({ x: 1600, z: 1500 });
    const st = computeItemStatuses(store().project.items, store().project.room, null);
    expect(st[a].overlap || st[b].overlap).toBe(false);
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
    // (600, 600)은 B의 변이 벽 100 mm 이내라 (500, 500)으로 붙으므로 벽에서 먼 (1000, 1000)으로 확인한다(T-008)
    h.onFloorPointerMove({ x: 1000, z: 1000 });
    h.onPointerUp();
    expect(itemOf(b)).toMatchObject({ x: 1000, z: 1000 });
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

describe('화면 기준 자석 거리(T-022)', () => {
  it('mmPerPx 5면 60 mm 이내에서 붙고, 미리보기 위치와 놓은 위치가 같다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 500 + 60, z: 1500 }, 5);
    expect(store().dragPreview).toEqual({ itemId: a, x: 500, z: 1500 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 500, z: 1500 });
  });

  it('mmPerPx 5에서 61 mm는 안 붙고, mmPerPx를 안 주면 20 mm 기준', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 561, z: 1500 }, 5);
    expect(store().dragPreview).toEqual({ itemId: a, x: 561, z: 1500 });
    h.onFloorPointerMove({ x: 540, z: 1500 });
    expect(store().dragPreview).toEqual({ itemId: a, x: 540, z: 1500 });
    h.onFloorPointerMove({ x: 520, z: 1500 });
    expect(store().dragPreview).toEqual({ itemId: a, x: 500, z: 1500 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 500 });
  });

  it('확대(mmPerPx 2.5)는 30 mm 경계, 놓을 때도 마지막 거리를 쓴다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    h.onFloorPointerMove({ x: 530, z: 1500 }, 2.5);
    expect(store().dragPreview).toEqual({ itemId: a, x: 500, z: 1500 });
    h.onFloorPointerMove({ x: 531, z: 1500 }, 2.5);
    expect(store().dragPreview).toEqual({ itemId: a, x: 531, z: 1500 });
    h.onPointerUp();
    expect(itemOf(a)).toMatchObject({ x: 530 }); // 안 붙음: 격자 530
  });
});

describe('미리보기(draft) 끌기', () => {
  it('draft를 누르면 draft가 유지되고, 끄는 동안 임시 위치, 놓으면 updateDraft(격자), 가구는 그대로', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    store().selectItem(null);
    const id = store().startDraft({ name: 'D', w: 1000, d: 600, h: 700, x: 4000, z: 2500 });
    h.onItemPointerDown(id, { x: 4000, z: 2500 });
    expect(store().draft?.id).toBe(id);
    h.onFloorPointerMove({ x: 4000, z: 2500 });
    h.onFloorPointerMove({ x: 4256, z: 2494 });
    expect(store().dragPreview).toEqual({ itemId: id, x: 4256, z: 2494 });
    expect(store().draft).toMatchObject({ x: 4000, z: 2500 });
    h.onPointerUp();
    expect(store().draft).toMatchObject({ x: 4260, z: 2490 });
    expect(store().dragPreview).toBeNull();
    expect(itemOf(a)).toMatchObject({ x: 1800, z: 1500 });
    expect(store().project.items).toHaveLength(1);
  });

  it('draft는 다른 가구에 자석처럼 붙는다', () => {
    const h = createPlacementHandlers(store);
    addA(); // x 1800, 폭 1000: 오른쪽 변 2300
    store().selectItem(null);
    const id = store().startDraft({ name: 'D', w: 400, d: 400, h: 700, x: 3000, z: 1500 });
    h.onItemPointerDown(id, { x: 3000, z: 1500 });
    h.onFloorPointerMove({ x: 2500 - SNAP_MM + 5, z: 1500 });
    expect(store().dragPreview!.x - 200).toBe(2300);
    h.onPointerUp();
    expect(store().draft!.x - 200).toBe(2300);
  });

  it('확정된 가구를 누르면 draft는 버려지고, 빈 곳 탭은 draft를 버리지 않는다', () => {
    const h = createPlacementHandlers(store);
    const a = addA();
    store().selectItem(null);
    store().startDraft({ name: 'D', w: 400, d: 400, h: 700 });
    h.onBackgroundTap();
    expect(store().draft).not.toBeNull();
    h.onItemPointerDown(a, { x: 1800, z: 1500 });
    expect(store().draft).toBeNull();
    expect(store().selectedItemId).toBe(a);
  });
});
