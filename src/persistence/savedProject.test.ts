import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../store/projectStore';
import type { Project } from '../contracts/types';
import { parseSavedProject, SAVE_FORMAT, serializeProject } from './savedProject';

const withItem = (): Project => ({
  ...createDefaultProject(),
  displayUnit: 'cm',
  items: [{ id: 'a', name: '침대', kind: 'bed', w: 1100, d: 2000, h: 450, x: 800, z: 1500, rotationDeg: 90, elevation: 0, color: '#7aa2d6' }],
});
// 시험용으로 필드를 마음대로 망가뜨리려고 느슨한 타입을 쓴다.
type Loose = { [key: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const text = (mutate: (p: Loose) => void) => {
  const saved = JSON.parse(serializeProject(withItem()));
  mutate(saved.project);
  return JSON.stringify(saved);
};

describe('parseSavedProject 정상 입력', () => {
  it('저장한 것을 그대로 읽는다(왕복)', () => {
    const p = withItem();
    expect(parseSavedProject(serializeProject(p))).toEqual(p);
  });
  it('기본 방도 읽는다', () => {
    const p = createDefaultProject();
    expect(parseSavedProject(serializeProject(p))).toEqual(p);
  });
  it('방 밖에 놓인 가구도 읽는다(막지 않는다)', () => {
    expect(parseSavedProject(text((p) => (p.items[0].x = -500)))).not.toBeNull();
  });
});

describe('parseSavedProject 거부', () => {
  it('빈 값, 깨진 JSON, 글자', () => {
    expect(parseSavedProject('')).toBeNull();
    expect(parseSavedProject('{ 깨짐')).toBeNull();
    expect(parseSavedProject('안녕')).toBeNull();
    expect(parseSavedProject('null')).toBeNull();
    expect(parseSavedProject('[]')).toBeNull();
  });
  it('format·version이 다름, project 없음', () => {
    const base = JSON.parse(serializeProject(withItem()));
    expect(parseSavedProject(JSON.stringify({ ...base, format: 'room-layout' }))).toBeNull();
    expect(parseSavedProject(JSON.stringify({ ...base, version: 2 }))).toBeNull();
    expect(parseSavedProject(JSON.stringify({ format: SAVE_FORMAT, version: 1 }))).toBeNull();
    expect(parseSavedProject(JSON.stringify(base.project))).toBeNull(); // 감싸지 않은 Project
  });
  it('알 수 없는 표시 단위', () => {
    expect(parseSavedProject(text((p) => (p.displayUnit = 'inch')))).toBeNull();
  });
  it('단위 혼용: 방이 m 값(3.6)으로 들어온 경우는 정수가 아니거나 범위 밖', () => {
    expect(parseSavedProject(text((p) => (p.room.corners = [{ x: 0, z: 0 }, { x: 3.6, z: 0 }, { x: 3.6, z: 3 }, { x: 0, z: 3 }])))).toBeNull();
    expect(parseSavedProject(text((p) => (p.items[0].w = 110.5)))).toBeNull();
    expect(parseSavedProject(text((p) => (p.items[0].w = 1.1)))).toBeNull();
  });
  it('방 폭·깊이가 0, 음수, 범위 밖', () => {
    const rect = (w: number, d: number) => [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: d }, { x: 0, z: d }];
    expect(parseSavedProject(text((p) => (p.room.corners = rect(0, 3000))))).toBeNull();
    expect(parseSavedProject(text((p) => (p.room.corners = rect(-3600, 3000))))).toBeNull();
    expect(parseSavedProject(text((p) => (p.room.corners = rect(3600, 20001))))).toBeNull();
    expect(parseSavedProject(text((p) => (p.room.corners = rect(499, 3000))))).toBeNull();
  });
  it('꼭짓점이 3개 미만이거나 글자', () => {
    expect(parseSavedProject(text((p) => (p.room.corners = [{ x: 0, z: 0 }, { x: 3600, z: 0 }])))).toBeNull();
    expect(parseSavedProject(text((p) => (p.room.corners[1].x = '3600')))).toBeNull();
  });
  it('천장 높이 범위 밖, 글자', () => {
    expect(parseSavedProject(text((p) => (p.room.ceilingHeight = 0)))).toBeNull();
    expect(parseSavedProject(text((p) => (p.room.ceilingHeight = 24)))).toBeNull();
    expect(parseSavedProject(text((p) => (p.room.ceilingHeight = '2400')))).toBeNull();
  });
  it('가구 치수가 0, 음수, 범위 밖, null', () => {
    for (const bad of [0, -600, 9, 10001, null, 'x']) {
      expect(parseSavedProject(text((p) => (p.items[0].d = bad)))).toBeNull();
    }
  });
  it('가구 필드 빠짐·잘못된 종류·회전이 정수 아님', () => {
    expect(parseSavedProject(text((p) => delete p.items[0].id))).toBeNull();
    expect(parseSavedProject(text((p) => (p.items[0].name = 5)))).toBeNull();
    expect(parseSavedProject(text((p) => (p.items[0].kind = 'piano')))).toBeNull();
    expect(parseSavedProject(text((p) => (p.items[0].rotationDeg = 45.5)))).toBeNull();
    expect(parseSavedProject(text((p) => (p.items = 'none')))).toBeNull();
    expect(parseSavedProject(text((p) => (p.items = [null])))).toBeNull();
  });
  it('개구부 모양이 틀림', () => {
    expect(parseSavedProject(text((p) => (p.room.openings = [{ id: 'o', type: 'gate', wall: 0, offset: 0, width: 900, height: 2000, sill: 0 }])))).toBeNull();
  });
});

describe('벽·문·이름표 저장', () => {
  const withStructure = (): Project => {
    const p = createDefaultProject();
    p.room.walls = [{ id: 'w1', a: { x: 1800, z: 0 }, b: { x: 1800, z: 2000 }, thickness: 100 }];
    p.room.openings = [
      { id: 'o1', type: 'door', wall: 'w1', offset: 500, width: 900, height: 2100, sill: 0, hinge: 'end', swing: 'opposite' },
      { id: 'o2', type: 'window', wall: 0, offset: 800, width: 1200, height: 1200, sill: 900 },
    ];
    p.room.labels = [{ id: 'l1', name: '거실', at: { x: 900, z: 1500 } }];
    return p;
  };
  const mutated = (fn: (room: Loose) => void) => {
    const saved = JSON.parse(serializeProject(withStructure()));
    fn(saved.project.room);
    return JSON.stringify(saved);
  };

  it('왕복한다(hinge·swing 포함)', () => {
    const p = withStructure();
    expect(parseSavedProject(serializeProject(p))).toEqual(p);
  });
  it('이전 저장본(walls·labels 없음)은 빈 배열로 받는다', () => {
    const text = mutated((r) => {
      delete r.walls;
      delete r.labels;
      r.openings = [];
    });
    const room = parseSavedProject(text)?.room;
    expect(room?.walls).toEqual([]);
    expect(room?.labels).toEqual([]);
  });
  it('기울어진 벽, 길이 0인 벽을 거절한다', () => {
    expect(parseSavedProject(mutated((r) => (r.walls[0].b = { x: 1900, z: 2000 })))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.walls[0].b = { x: 1800, z: 0 })))).toBeNull();
  });
  it('두께가 범위 밖이거나 좌표가 정수가 아닌 벽을 거절한다', () => {
    expect(parseSavedProject(mutated((r) => (r.walls[0].thickness = 5)))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.walls[0].thickness = 1001)))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.walls[0].thickness = 0)))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.walls[0].thickness = -100)))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.walls[0].thickness = '100')))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.walls[0].a.z = 0.5)))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.walls[0].a.x = 1.8)))).toBeNull();
  });
  it('walls·labels가 배열이 아니면 거절한다', () => {
    expect(parseSavedProject(mutated((r) => (r.walls = {})))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.labels = '거실')))).toBeNull();
  });
  it('없는 벽을 가리키는 문을 거절한다', () => {
    expect(parseSavedProject(mutated((r) => (r.openings[0].wall = 'nope')))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.openings[1].wall = 4)))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.openings[1].wall = -1)))).toBeNull();
  });
  it('hinge·swing 값이 틀리면 거절한다', () => {
    expect(parseSavedProject(mutated((r) => (r.openings[0].hinge = 'left')))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.openings[0].swing = 1)))).toBeNull();
  });
  it('이름이 글자가 아니거나 위치가 틀린 이름표를 거절한다', () => {
    expect(parseSavedProject(mutated((r) => (r.labels[0].name = 3)))).toBeNull();
    expect(parseSavedProject(mutated((r) => delete r.labels[0].name))).toBeNull();
    expect(parseSavedProject(mutated((r) => (r.labels[0].at = { x: '1', z: 2 })))).toBeNull();
  });
});
