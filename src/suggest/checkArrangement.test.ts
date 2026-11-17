import { describe, expect, it } from 'vitest';
import { rectCorners } from '../contracts/room';
import type { InteriorWall, Opening } from '../contracts/types';
import { doorRects } from '../furniture/placement';
import { checkArrangement } from './checkArrangement';
import { item, ROOM } from './fixtures';

const bed = item('a', '침대', 1000, 2000, 500, 1000);
const desk = item('b', '책상', 1200, 600, 2600, 300);
const mv = (id: string, x: number, z: number, rotationDeg = 0) => ({ id, x, z, rotationDeg });

describe('checkArrangement', () => {
  it('문제가 없으면 빈 목록(벽에 정확히 붙은 것은 겹침이 아니다)', () => {
    expect(checkArrangement([bed, desk], [mv('a', 500, 1000), mv('b', 1600, 300)], ROOM)).toEqual([]); // x 1000에서 맞닿음
  });

  it('1 mm 겹침은 번호와 이름을 대서 한 번만 말한다', () => {
    const p = checkArrangement([bed, desk], [mv('a', 500, 1000), mv('b', 1599, 300)], ROOM);
    expect(p).toEqual(['1번 가구(침대)가 2번 가구(책상)와 겹칩니다.']);
  });

  it('이동의 회전을 반영한다(90도면 폭·깊이 교환)', () => {
    // 책상 1200×600을 90도로 세우면 x 600, z 1200 — 침대(x 0~1000, z 0~2000)와 겹침
    const p = checkArrangement([bed, desk], [mv('a', 500, 1000), mv('b', 1200, 600, 90)], ROOM);
    expect(p).toEqual(['1번 가구(침대)가 2번 가구(책상)와 겹칩니다.']);
  });

  it('방보다 큰 가구는 방 밖', () => {
    const big = item('c', '큰장', 4000, 500);
    expect(checkArrangement([big], [mv('c', 1800, 250)], ROOM)).toEqual(['1번 가구(큰장)가 방 밖으로 나갑니다.']);
  });

  it('칸막이 벽과 겹침', () => {
    const wall: InteriorWall = { id: 'w', a: { x: 2000, z: 0 }, b: { x: 2000, z: 1500 }, thickness: 100 };
    const room = { ...ROOM, walls: [wall] };
    const wardrobe = item('c', '옷장', 800, 500);
    expect(checkArrangement([bed, desk, wardrobe], [mv('a', 500, 1000), mv('b', 2600, 300), mv('c', 1900, 600)], room)).toContain(
      '3번 가구(옷장)가 칸막이 벽과 겹칩니다.',
    );
  });

  it('문이 열리는 자리', () => {
    const door: Opening = { id: 'o', type: 'door', wall: 0, offset: 1000, width: 900, height: 2000, sill: 0 };
    const room = { corners: rectCorners(3600, 3000), walls: [], openings: [door] };
    const swing = doorRects(room)[0];
    const cx = (swing.minX + swing.maxX) / 2;
    const cz = (swing.minZ + swing.maxZ) / 2;
    expect(checkArrangement([desk], [mv('b', cx, cz)], room)).toEqual(['1번 가구(책상)가 문이 열리는 자리에 있습니다.']);
  });
});
