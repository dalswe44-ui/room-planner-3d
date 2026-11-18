// 2026-11-19 QA 5-4: ㄱ자 방
import { beforeEach, describe, expect, it } from 'vitest';
import { notchOf, roomCorners } from '../contracts/room';
import { openingSpan } from '../contracts/structure';
import { outerWallName } from '../structure/StructurePanel';
import { createDefaultProject, useProjectStore } from './projectStore';

const store = () => useProjectStore.getState();
beforeEach(() => {
  useProjectStore.setState({ ...useProjectStore.getInitialState(), project: createDefaultProject(), past: [], future: [] });
});

describe('roomCorners·notchOf', () => {
  it('네 모서리 모두 만들고 되읽는다', () => {
    for (const corner of ['tl', 'tr', 'br', 'bl'] as const) {
      const n = { corner, w: 1200, d: 800 };
      const cs = roomCorners(3600, 3000, n);
      expect(cs).toHaveLength(6);
      expect(notchOf(cs)).toEqual(n);
    }
    expect(notchOf(roomCorners(3600, 3000, null))).toBeNull();
  });
});

describe('setRoomNotch', () => {
  it('ㄱ자로 바꾸고 크기를 바꿔도 빠진 모서리가 남으며, 되돌리기 한 번에 직사각형', () => {
    store().setRoomNotch({ corner: 'br', w: 1500, d: 1000 });
    expect(notchOf(store().project.room.corners)).toEqual({ corner: 'br', w: 1500, d: 1000 });
    store().setRoomSize({ width: 4000, depth: 3000, ceilingHeight: 2400 });
    expect(store().project.room.corners).toEqual(roomCorners(4000, 3000, { corner: 'br', w: 1500, d: 1000 }));
    store().undo();
    store().undo();
    expect(store().project.room.corners).toHaveLength(4);
  });
  it('빠진 길이는 방에서 300 mm 이상 남게 줄인다', () => {
    store().setRoomNotch({ corner: 'tl', w: 3500, d: 2900 });
    expect(notchOf(store().project.room.corners)).toEqual({ corner: 'tl', w: 3300, d: 2700 });
    store().setRoomSize({ width: 500, depth: 3000, ceilingHeight: 2400 });
    expect(notchOf(store().project.room.corners)).toEqual({ corner: 'tl', w: 200, d: 2700 });
  });
  it('바깥 벽의 문은 같은 줄의 새 벽으로 옮기고, 빠진 쪽에 있던 문은 지운다', () => {
    const keep = store().addOpening({ type: 'door', wall: 2, offset: 2700 }); // 아래쪽 벽, x 900 ~ 0 쪽(벽 2는 오른쪽에서 왼쪽으로)
    const gone = store().addOpening({ type: 'window', wall: 2, offset: 100 }); // x 3500 ~ 2300
    const before = openingSpan(store().project.room, store().project.room.openings.find((o) => o.id === keep)!)!;
    store().setRoomNotch({ corner: 'br', w: 1800, d: 1000 });
    const room = store().project.room;
    expect(room.openings.map((o) => o.id)).toEqual([keep]);
    const after = openingSpan(room, room.openings[0]!)!;
    expect(after.from).toEqual(before.from);
    expect(after.to).toEqual(before.to);
    expect(gone).toBeTruthy();
  });
});

describe('바깥 벽 이름', () => {
  it('ㄱ자 방은 쪽과 꺾인 곳으로', () => {
    const room = { corners: roomCorners(3600, 3000, { corner: 'br', w: 1500, d: 1000 }), walls: [] };
    expect([0, 1, 2, 3, 4, 5].map((i) => outerWallName(room, i))).toEqual([
      '위쪽 벽',
      '오른쪽 벽',
      '아래쪽 벽 (꺾인 곳)',
      '오른쪽 벽 (꺾인 곳)',
      '아래쪽 벽',
      '왼쪽 벽',
    ]);
  });
});

describe('AI 추천 지시문', () => {
  it('ㄱ자 방이면 방이 아닌 칸을 알리고, 직사각형이면 그 줄이 없다', async () => {
    const { buildSuggestPrompt } = await import('../contracts/layoutSuggest');
    const L = { corners: roomCorners(3600, 3000, { corner: 'br', w: 1500, d: 1000 }), walls: [], openings: [] };
    const R = { corners: roomCorners(3600, 3000, null), walls: [], openings: [] };
    expect(buildSuggestPrompt('공부', L, [])).toContain('x 2100 ~ 3600, z 2000 ~ 3000');
    expect(buildSuggestPrompt('공부', R, [])).not.toContain('직사각형이 아닙니다');
  });
});
