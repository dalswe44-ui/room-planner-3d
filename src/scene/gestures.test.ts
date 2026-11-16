import { describe, expect, it, vi } from 'vitest';
import type { PlacementHandlers, PointMm } from '../contracts/types';
import { PlacementRouter } from './gestures';

const floor: PointMm = { x: 1000, z: 800 };

function setup() {
  const handlers: PlacementHandlers = {
    onItemPointerDown: vi.fn(),
    onBackgroundTap: vi.fn(),
    onFloorPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
  };
  const setCameraEnabled = vi.fn();
  const router = new PlacementRouter({
    handlers,
    toFloor: () => floor,
    setCameraEnabled,
  });
  return { router, handlers, setCameraEnabled };
}

const hit = { itemId: 'A', center: { x: 1800, z: 1500 } };

describe('가구 끌기', () => {
  it('가구를 누르면 카메라를 끄고 onItemPointerDown을 바닥 좌표와 함께 부른다', () => {
    const { router, handlers, setCameraEnabled } = setup();
    router.pointerDown(1, 10, 10, true, hit);
    expect(setCameraEnabled).toHaveBeenNthCalledWith(1, false);
    expect(handlers.onItemPointerDown).toHaveBeenCalledWith('A', floor);
  });

  it('끄는 동안 움직임은 onFloorPointerMove로, 뗄 때 onPointerUp과 카메라 켜기로 끝난다', () => {
    const { router, handlers, setCameraEnabled } = setup();
    router.pointerDown(1, 10, 10, true, hit);
    router.pointerMove(1, 40, 40);
    router.pointerMove(1, 80, 20);
    expect(handlers.onFloorPointerMove).toHaveBeenCalledTimes(2);
    router.pointerUp(1);
    expect(handlers.onPointerUp).toHaveBeenCalledTimes(1);
    expect(setCameraEnabled).toHaveBeenLastCalledWith(true);
    expect(handlers.onBackgroundTap).not.toHaveBeenCalled();
  });

  it('가구 누름이 취소되어도 onPointerUp과 카메라 켜기가 호출된다', () => {
    const { router, handlers, setCameraEnabled } = setup();
    router.pointerDown(1, 10, 10, true, hit);
    router.pointerCancel(1);
    expect(handlers.onPointerUp).toHaveBeenCalledTimes(1);
    expect(setCameraEnabled).toHaveBeenLastCalledWith(true);
  });

  it('가구를 끌지 않을 때는 onFloorPointerMove를 부르지 않는다', () => {
    const { router, handlers } = setup();
    router.pointerDown(1, 10, 10, true, hit);
    router.pointerUp(1);
    expect(handlers.onFloorPointerMove).not.toHaveBeenCalled();
  });

  it('두 번째 손가락이 가구 위에 놓여도 가구 끌기를 시작하지 않는다', () => {
    const { router, handlers } = setup();
    router.pointerDown(1, 10, 10, true, null); // 빈 곳에서 카메라 조작 시작
    router.pointerDown(2, 300, 300, true, hit);
    expect(handlers.onItemPointerDown).not.toHaveBeenCalled();
  });

  it('보조 버튼(오른쪽 버튼)으로 누른 가구는 가구 조작이 아니다', () => {
    const { router, handlers, setCameraEnabled } = setup();
    router.pointerDown(1, 10, 10, false, hit);
    expect(handlers.onItemPointerDown).not.toHaveBeenCalled();
    expect(setCameraEnabled).not.toHaveBeenCalled();
  });
});

describe('빈 곳', () => {
  it('빈 곳을 짧게 누르고 떼면 onBackgroundTap이 한 번 불린다', () => {
    const { router, handlers, setCameraEnabled } = setup();
    router.pointerDown(1, 10, 10, true, null);
    router.pointerMove(1, 12, 11);
    router.pointerUp(1);
    expect(handlers.onBackgroundTap).toHaveBeenCalledTimes(1);
    expect(handlers.onItemPointerDown).not.toHaveBeenCalled();
    expect(setCameraEnabled).not.toHaveBeenCalled();
  });

  it('빈 곳에서 많이 끌면 탭이 아니고 카메라 조작이다', () => {
    const { router, handlers, setCameraEnabled } = setup();
    router.pointerDown(1, 10, 10, true, null);
    router.pointerMove(1, 80, 10);
    router.pointerUp(1);
    expect(handlers.onBackgroundTap).not.toHaveBeenCalled();
    expect(handlers.onFloorPointerMove).not.toHaveBeenCalled();
    expect(setCameraEnabled).not.toHaveBeenCalled();
  });

  it('두 손가락 제스처는 탭이 아니고 가구 조작도 아니다', () => {
    const { router, handlers } = setup();
    router.pointerDown(1, 10, 10, true, null);
    router.pointerDown(2, 100, 100, true, null);
    router.pointerUp(1);
    router.pointerUp(2);
    expect(handlers.onBackgroundTap).not.toHaveBeenCalled();
    expect(handlers.onItemPointerDown).not.toHaveBeenCalled();
  });

  it('취소된 누름은 탭이 아니다', () => {
    const { router, handlers } = setup();
    router.pointerDown(1, 10, 10, true, null);
    router.pointerCancel(1);
    expect(handlers.onBackgroundTap).not.toHaveBeenCalled();
  });

  it('추적하지 않은 포인터의 끝 알림은 무시한다', () => {
    const { router, handlers } = setup();
    router.pointerUp(99);
    router.pointerMove(99, 0, 0);
    expect(handlers.onPointerUp).not.toHaveBeenCalled();
    expect(handlers.onFloorPointerMove).not.toHaveBeenCalled();
  });
});

describe('mmPerPx 전달', () => {
  it('끄는 지점의 mmPerPx를 두 번째 인자로 넘기고, 못 구하면 undefined다', () => {
    const handlers: PlacementHandlers = {
      onItemPointerDown: vi.fn(),
      onBackgroundTap: vi.fn(),
      onFloorPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
    };
    const mmPerPxAt = vi.fn((x: number) => (x > 50 ? undefined : 5.1));
    const router = new PlacementRouter({ handlers, toFloor: () => floor, setCameraEnabled: vi.fn(), mmPerPxAt });
    router.pointerDown(1, 10, 10, true, hit);
    router.pointerMove(1, 40, 40);
    router.pointerMove(1, 80, 40);
    expect(handlers.onFloorPointerMove).toHaveBeenNthCalledWith(1, floor, 5.1);
    expect(handlers.onFloorPointerMove).toHaveBeenNthCalledWith(2, floor, undefined);
    expect(mmPerPxAt).toHaveBeenCalledWith(40, 40);
  });
});
