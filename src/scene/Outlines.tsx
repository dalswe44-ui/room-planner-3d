// 구조 편집용 선 그리기: 선택 테두리(먹색 바탕 위 노랑)와 그리는 중인 벽의 점선. 값은 받기만 한다.
import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { roomToWorld } from '../contracts/coords';
import type { Mm, PointMm } from '../contracts/types';
import { INK_COLOR, SELECTED_EDGE_COLOR } from './geometry';
import { wallRectCorners } from './structureGeometry';

type V3 = [number, number, number];

/** 방 좌표 모서리들을 높이 yMm + lift(mm)의 닫힌 선으로. 깊이 검사 없이 항상 보인다. */
export function RectOutline({ corners, yMm, lift = 0, dashed = false }: { corners: PointMm[]; yMm: Mm; lift?: Mm; dashed?: boolean }) {
  const points = useMemo<V3[]>(() => [...corners, corners[0]].map((c) => roomToWorld(c, yMm + lift) as V3), [corners, yMm, lift]);
  if (dashed) {
    return (
      <>
        <Line points={points} depthTest={false} color={INK_COLOR} lineWidth={3.5} dashed dashSize={0.06} gapSize={0.06} renderOrder={22} />
        <Line points={points} depthTest={false} color={SELECTED_EDGE_COLOR} lineWidth={2.5} dashed dashSize={0.06} gapSize={0.06} dashOffset={-0.06} renderOrder={23} />
      </>
    );
  }
  return (
    <>
      <Line points={points} depthTest={false} color={INK_COLOR} lineWidth={5} renderOrder={22} />
      <Line points={points} depthTest={false} color={SELECTED_EDGE_COLOR} lineWidth={2.5} renderOrder={23} />
    </>
  );
}

/** 그리는 중인 벽(store.wallPreview): 두께를 가진 사각형을 먹색·노랑 점선으로. a, b는 이미 곧게 편 값이어야 한다. */
export function WallPreviewOutline({ a, b, thickness }: { a: PointMm; b: PointMm; thickness: Mm }) {
  const corners = useMemo(() => wallRectCorners(a, b, thickness), [a, b, thickness]);
  if (a.x === b.x && a.z === b.z) return null;
  return <RectOutline corners={corners} yMm={0} lift={4} dashed />;
}
