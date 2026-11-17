import { describe, expect, it } from 'vitest';
import { answer, item, ROOM } from './fixtures';
import { parseSuggestion } from './parseSuggestion';

const ITEMS = [item('a', '침대', 1000, 2000), item('b', '책상', 1200, 600)];
const ok = (text: string) => {
  const r = parseSuggestion(text, ITEMS, ROOM);
  if (!r.ok) throw new Error(r.errors.join(' / '));
  return r;
};
const errors = (text: string) => {
  const r = parseSuggestion(text, ITEMS, ROOM);
  if (r.ok) throw new Error('오류여야 함');
  return r.errors;
};
const two = (a: object = {}, b: object = {}) => [
  { id: 1, back: 'top', left: 0, top: 0, ...a },
  { id: 2, back: 'top', left: 2000, top: 0, ...b },
];

describe('parseSuggestion 정상', () => {
  it('실제 id로 이동을 만들고 이유·덧붙임을 돌려준다', () => {
    const r = ok(answer(two(), { reasons: ['창가', 3, ''], tips: ['조명', null] }));
    expect(r.moves).toEqual([
      { id: 'a', x: 500, z: 1000, rotationDeg: 0 },
      { id: 'b', x: 2600, z: 300, rotationDeg: 0 },
    ]);
    expect(r.reasons).toEqual(['창가']);
    expect(r.tips).toEqual(['조명']);
  });

  it('코드 블록과 설명이 섞여도 첫 {부터 마지막 }까지 읽는다', () => {
    const r = ok('답이에요:\n```json\n' + answer(two()) + '\n```\n끝');
    expect(r.moves).toHaveLength(2);
  });

  it('back별 회전과 중심(90도면 폭·깊이 교환)', () => {
    const base = { left: 100, top: 200 };
    const c = (back: string) => ok(answer(two({ back, ...base }))).moves[0];
    expect(c('top')).toEqual({ id: 'a', x: 600, z: 1200, rotationDeg: 0 });
    expect(c('bottom')).toEqual({ id: 'a', x: 600, z: 1200, rotationDeg: 180 });
    expect(c('left')).toEqual({ id: 'a', x: 1100, z: 700, rotationDeg: 90 }); // 2000 × 1000
    expect(c('right')).toEqual({ id: 'a', x: 1100, z: 700, rotationDeg: 270 });
  });

  it('10 mm 단위로 반올림한다(경계 5는 올림)', () => {
    const m = ok(answer(two({ left: 14, top: 15 }))).moves[0];
    expect(m.x).toBe(10 + 500);
    expect(m.z).toBe(20 + 1000);
  });

  it('방 밖 값은 방 안으로 당긴다', () => {
    const m = ok(answer(two({ left: -300, top: 5000 }, { left: 9000, top: -1 }))).moves;
    expect(m[0]).toEqual({ id: 'a', x: 500, z: 3000 - 1000, rotationDeg: 0 }); // top = 1000
    expect(m[1].x).toBe(3600 - 600);
    expect(m[1].z).toBe(300);
  });

  it('벽에 정확히 붙는 값은 그대로 둔다', () => {
    const m = ok(answer(two({ left: 2600, top: 1000 }))).moves[0];
    expect(m).toEqual({ id: 'a', x: 3100, z: 2000, rotationDeg: 0 });
  });

  it('방보다 큰 가구는 left·top을 0으로', () => {
    const r = parseSuggestion(answer([{ id: 1, back: 'top', left: 500, top: 500 }]), [item('big', '큰장', 4000, 3500)], ROOM);
    expect(r.ok && r.moves[0]).toEqual({ id: 'big', x: 2000, z: 1750, rotationDeg: 0 });
  });
});

describe('parseSuggestion 오류', () => {
  it('JSON이 없거나 깨짐', () => {
    expect(errors('없음')).toHaveLength(1);
    expect(errors('{ 깨짐 }')).toHaveLength(1);
  });
  it('format·version 불일치', () => {
    expect(errors(answer(two(), { format: 'x' }))[0]).toContain('format');
    expect(errors(answer(two(), { version: 2 }))[0]).toContain('version');
  });
  it('items가 배열이 아님', () => {
    expect(errors(answer({} as never))[0]).toContain('items');
  });
  it('번호가 범위 밖·정수 아님', () => {
    expect(errors(answer(two({ id: 3 }))).join()).toContain('1~2');
    expect(errors(answer(two({ id: 0 }))).join()).toContain('1~2');
    expect(errors(answer(two({ id: 1.5 }))).join()).toContain('1~2');
  });
  it('번호 중복', () => {
    expect(errors(answer(two({}, { id: 1 }))).join()).toContain('두 번');
  });
  it('빠진 가구', () => {
    expect(errors(answer([two()[0]]))).toEqual(['2번 가구가 빠졌어요.']);
  });
  it('back이 네 값이 아님', () => {
    expect(errors(answer(two({ back: 'up' }))).join()).toContain('back');
  });
  it('left/top이 유한한 숫자가 아님', () => {
    expect(errors(answer(two({ left: '100' }))).join()).toContain('숫자');
    expect(errors(answer(two({ top: null }))).join()).toContain('숫자');
    expect(errors(answer(two({ left: 'INF' })).replace('"INF"', '1e999')).join()).toContain('숫자'); // JSON에서 Infinity
  });
});
