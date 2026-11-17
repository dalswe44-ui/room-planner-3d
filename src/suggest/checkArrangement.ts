// 이동을 적용한 배치를 placement.ts의 판정으로 검사해, 사람이 읽을 문제 문장 목록을 만든다.
// 같은 문장을 AI에게 고쳐 달라는 지시문과 화면 경고에 쓴다. 가구 번호는 items의 순서(1부터).
import type { FurnitureItem } from '../contracts/types';
import { computeItemStatuses, footprint, footprintsOverlap, type PlacementRoom } from '../furniture/placement';
import type { ArrangementMove } from './parseSuggestion';

export function checkArrangement(
  items: readonly FurnitureItem[],
  moves: readonly ArrangementMove[],
  room: PlacementRoom,
): string[] {
  const byId = new Map(moves.map((m) => [m.id, m]));
  const placed = items.map((it) => {
    const m = byId.get(it.id);
    return m ? { ...it, x: m.x, z: m.z, rotationDeg: m.rotationDeg } : it;
  });
  const statuses = computeItemStatuses(placed, room, null);
  const label = (i: number) => `${i + 1}번 가구(${placed[i].name})`;
  const problems: string[] = [];
  placed.forEach((it, i) => {
    const s = statuses[it.id];
    if (s.overlap) {
      // 겹친 쌍은 번호가 작은 쪽에서 한 번만 말한다. 상대는 발자국으로 직접 찾는다.
      placed.forEach((other, j) => {
        if (j > i && footprintsOverlap(footprint(it), footprint(other))) problems.push(`${label(i)}가 ${label(j)}와 겹칩니다.`);
      });
    }
    if (s.outside) problems.push(`${label(i)}가 방 밖으로 나갑니다.`);
    if (s.wall) problems.push(`${label(i)}가 칸막이 벽과 겹칩니다.`);
    if (s.door) problems.push(`${label(i)}가 문이 열리는 자리에 있습니다.`);
  });
  return problems;
}
