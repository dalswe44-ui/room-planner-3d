import { describe, expect, it } from 'vitest';
import { rectCorners } from './room';
import {
  BACK_TO_ROTATION,
  backOfRotation,
  buildSuggestPrompt,
  buildSuggestRepairPrompt,
  footprintOfBack,
  suggestRoomSize,
  type SuggestItem,
  type SuggestRoom,
} from './layoutSuggest';

const room: SuggestRoom = {
  corners: rectCorners(3600, 3000),
  walls: [{ id: 'w1', a: { x: 1800, z: 0 }, b: { x: 1800, z: 1000 }, thickness: 100 }],
  openings: [
    { id: 'd1', type: 'door', wall: 2, offset: 500, width: 900, height: 2100, sill: 0 },
    { id: 'n1', type: 'window', wall: 0, offset: 2200, width: 1200, height: 1200, sill: 900 },
  ],
};
const items: SuggestItem[] = [
  { name: '침대', kind: 'bed', w: 1100, d: 2000, h: 450, x: 550, z: 1000, rotationDeg: 0 },
  { name: '책상', kind: 'desk', w: 1200, d: 600, h: 720, x: 3300, z: 1500, rotationDeg: 270 },
];

describe('뒤쪽 방향과 회전', () => {
  it('top 0, left 90, bottom 180, right 270이고 서로 되돌려진다', () => {
    expect(BACK_TO_ROTATION).toEqual({ top: 0, left: 90, bottom: 180, right: 270 });
    for (const [back, deg] of Object.entries(BACK_TO_ROTATION)) expect(backOfRotation(deg)).toBe(back);
    expect(backOfRotation(-90)).toBe('right');
    expect(backOfRotation(360)).toBe('top');
  });
  it('left·right면 가로세로가 바뀐다', () => {
    expect(footprintOfBack({ w: 1200, d: 600 }, 'top')).toEqual({ fw: 1200, fd: 600 });
    expect(footprintOfBack({ w: 1200, d: 600 }, 'right')).toEqual({ fw: 600, fd: 1200 });
  });
});

describe('buildSuggestPrompt', () => {
  const p = buildSuggestPrompt('공부하는 환경', room, items);
  it('목적, 방 크기, 가구 번호와 지금 자리를 담는다', () => {
    expect(suggestRoomSize(room)).toEqual({ width: 3600, depth: 3000 });
    expect(p).toContain('사용자의 목적: "공부하는 환경"');
    expect(p).toContain('가로(x) 3600, 세로(z) 3000');
    expect(p).toContain('1. 침대 (bed): 폭 w 1100 × 깊이 d 2000 × 높이 450. 지금: back "top", left 0, top 0');
    // 책상은 뒤가 오른쪽 벽: 차지하는 사각형은 600 × 1200, 왼쪽 변 3000, 위쪽 변 900
    expect(p).toContain('2. 책상 (desk): 폭 w 1200 × 깊이 d 600 × 높이 720. 지금: back "right", left 3000, top 900');
  });
  it('칸막이, 문이 열리는 자리, 창문을 적는다', () => {
    expect(p).toContain('칸막이 벽: x 1750~1850, z 0~1000');
    // 아래쪽 벽(벽 2)은 (3600,3000)에서 (0,3000)으로 간다. offset 500, 폭 900 → x 3100~2200
    expect(p).toContain('문: 아래쪽 벽의 (3100, 3000)~(2200, 3000)');
    expect(p).toContain('문이 열리는 자리: x 2200~3100, z 2100~3000');
    expect(p).toContain('창문: 위쪽 벽의 (2200, 0)~(3400, 0), 바닥에서 900~2100 높이');
  });
  it('고정된 것이 없으면 없음이라고 적는다', () => {
    expect(buildSuggestPrompt('휴식', { corners: rectCorners(3000, 3000), walls: [], openings: [] }, items)).toContain('- 없음');
  });
  it('고쳐 달라는 지시문은 앞선 답과 문제를 담는다', () => {
    const r = buildSuggestRepairPrompt(p, '{"items":[]}', ['2번 가구(책상)가 1번 가구(침대)와 겹칩니다.']);
    expect(r.startsWith(p)).toBe(true);
    expect(r).toContain('{"items":[]}');
    expect(r).toContain('- 2번 가구(책상)가 1번 가구(침대)와 겹칩니다.');
  });
});
