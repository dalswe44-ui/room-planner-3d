// 포인터 제스처 분류. 가구 위에서 시작한 한 포인터는 가구 조작이고, 나머지는 카메라 조작이다.
// 가구를 끄는 동안 카메라를 멈추고, 빈 곳을 짧게 누른 것만 선택 해제로 본다. React와 DOM에 기대지 않는다.
import type { PlacementHandlers, PointMm } from '../contracts/types';
import type { FurnitureHit } from './pointer';

export interface PlacementRouterDeps {
  handlers: PlacementHandlers;
  /** 화면 좌표 → 바닥 위 방 좌표(mm). 바닥과 만나지 않으면 null. */
  toFloor(clientX: number, clientY: number): PointMm | null;
  /** 카메라 조작(OrbitControls)을 켜거나 끈다. */
  setCameraEnabled(enabled: boolean): void;
  /** 짧은 누름으로 볼 최대 이동 거리(px) */
  tapSlopPx?: number;
}

export class PlacementRouter {
  private readonly deps: PlacementRouterDeps;
  private readonly slop: number;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** 가구를 끌고 있는 포인터 */
  private furnitureDrag: number | null = null;
  /** 빈 곳에서 시작한 짧은 누름 후보 */
  private tapCandidate: { pointerId: number; x: number; y: number } | null = null;

  constructor(deps: PlacementRouterDeps) {
    this.deps = deps;
    this.slop = deps.tapSlopPx ?? 6;
  }

  /**
   * 포인터를 눌렀다.
   * primary: 왼쪽 버튼, 터치, 펜이면 true. 가구 조작과 빈 곳 탭은 primary일 때만 생긴다.
   * hit: 그 자리에 있는 가구(primary일 때만 확인한다).
   */
  pointerDown(pointerId: number, clientX: number, clientY: number, primary: boolean, hit: FurnitureHit | null): void {
    this.pointers.set(pointerId, { x: clientX, y: clientY });
    if (this.pointers.size > 1 || !primary) {
      // 두 번째 포인터나 보조 버튼은 카메라 조작이다. 진행 중이던 탭도 취소한다.
      this.tapCandidate = null;
      return;
    }
    if (hit) {
      this.furnitureDrag = pointerId;
      this.tapCandidate = null;
      this.deps.setCameraEnabled(false);
      this.deps.handlers.onItemPointerDown(hit.itemId, this.deps.toFloor(clientX, clientY) ?? hit.center);
      return;
    }
    this.tapCandidate = { pointerId, x: clientX, y: clientY };
  }

  pointerMove(pointerId: number, clientX: number, clientY: number): void {
    const tracked = this.pointers.get(pointerId);
    if (!tracked) return;
    tracked.x = clientX;
    tracked.y = clientY;
    if (this.furnitureDrag === pointerId) {
      const floor = this.deps.toFloor(clientX, clientY);
      if (floor) this.deps.handlers.onFloorPointerMove(floor);
      return;
    }
    const tap = this.tapCandidate;
    if (tap && tap.pointerId === pointerId && Math.hypot(clientX - tap.x, clientY - tap.y) > this.slop) {
      this.tapCandidate = null;
    }
  }

  pointerUp(pointerId: number): void {
    this.release(pointerId, true);
  }

  pointerCancel(pointerId: number): void {
    this.release(pointerId, false);
  }

  private release(pointerId: number, completed: boolean): void {
    if (!this.pointers.delete(pointerId)) return;
    if (this.furnitureDrag === pointerId) {
      this.furnitureDrag = null;
      this.deps.handlers.onPointerUp();
      this.deps.setCameraEnabled(true);
      return;
    }
    if (this.tapCandidate?.pointerId === pointerId) {
      this.tapCandidate = null;
      if (completed && this.pointers.size === 0) this.deps.handlers.onBackgroundTap();
    }
  }
}
