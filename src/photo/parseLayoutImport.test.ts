import { describe, expect, it } from 'vitest';
import { parseLayoutImport, type ParseResult } from './parseLayoutImport';

const base = { displayUnit: 'cm' as const, ceilingHeight: 2400 };
const doc = (over: Record<string, unknown> = {}, item: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 'room-layout',
    version: 1,
    unit: 'cm',
    room: { width: 340, depth: 280, height: null },
    items: [{ name: '침대', w: 100, d: 200, h: 45, left: 0, top: 0, rotationDeg: 0, ...item }],
    notes: ['메모'],
    ...over,
  });

function okOf(r: ParseResult) {
  if (!r.ok) throw new Error(`실패: ${r.errors.join(' / ')}`);
  return r;
}
const errorsOf = (r: ParseResult) => (r.ok ? [] : r.errors);

describe('parseLayoutImport 정상 입력', () => {
  it('cm를 mm로 바꾸고 left/top을 중심으로 바꾼다', () => {
    const r = okOf(parseLayoutImport(doc(), base));
    expect(r.project.room.corners).toEqual([
      { x: 0, z: 0 },
      { x: 3400, z: 0 },
      { x: 3400, z: 2800 },
      { x: 0, z: 2800 },
    ]);
    expect(r.project.room.ceilingHeight).toBe(2400);
    expect(r.project.displayUnit).toBe('cm');
    const it = r.project.items[0];
    expect([it.w, it.d, it.h, it.x, it.z, it.rotationDeg]).toEqual([1000, 2000, 450, 500, 1000, 0]);
    expect(r.notes).toEqual(['메모']);
    expect(r.warnings.join()).toContain('천장');
  });

  it('m와 mm도 읽는다', () => {
    const m = okOf(parseLayoutImport(doc({ unit: 'm', room: { width: 3.4, depth: 2.8, height: 2.5 } }, { w: 1, d: 2, h: 0.45, left: 0, top: 0 }), base));
    expect(m.project.room.ceilingHeight).toBe(2500);
    expect(m.project.items[0].w).toBe(1000);
    const mm = okOf(parseLayoutImport(doc({ unit: 'mm', room: { width: 3400, depth: 2800, height: 2400 } }, { w: 1000, d: 2000, h: 450 }), base));
    expect(mm.project.items[0].d).toBe(2000);
  });

  it('코드 블록과 설명 문장으로 감싼 입력을 읽는다', () => {
    const r = okOf(parseLayoutImport('읽었습니다.\n```json\n' + doc() + '\n```\n끝', base));
    expect(r.project.items).toHaveLength(1);
  });

  it('h가 null이면 600 mm와 경고, 위치가 없으면 가운데와 경고, 이름이 비면 "가구"', () => {
    const r = okOf(parseLayoutImport(doc({}, { name: ' ', h: null, left: null, top: null }), base));
    const it = r.project.items[0];
    expect([it.name, it.h, it.x, it.z]).toEqual(['가구', 600, 1700, 1400]);
    expect(r.warnings.some((w) => w.includes('600 mm'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('위치가 없어 가운데에 둠'))).toBe(true);
  });

  it('left만 있고 top이 null이면 left는 쓰고 세로만 가운데, 경고에 top이 없다고 적는다', () => {
    const r = okOf(parseLayoutImport(doc({}, { left: 50, top: null }), base));
    const it = r.project.items[0];
    expect([it.x, it.z]).toEqual([1000, 1400]);
    expect(r.warnings.some((w) => w.includes('top') && w.includes('세로'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('위치가 없어'))).toBe(false);
  });

  it('top만 있고 left가 null이면 top은 쓰고 가로만 가운데, 경고에 left가 없다고 적는다', () => {
    const r = okOf(parseLayoutImport(doc({}, { left: null, top: 30 }), base));
    const it = r.project.items[0];
    expect([it.x, it.z]).toEqual([1700, 1300]);
    expect(r.warnings.some((w) => w.includes('left') && w.includes('가로'))).toBe(true);
  });

  it('left가 글자이면 거부한다', () => {
    expect(errorsOf(parseLayoutImport(doc({}, { left: '왼쪽', top: 0 }), base)).join()).toContain('숫자');
  });

  it('높이가 null이면 종류 기본 높이, 상자는 600 mm, 경고에 어떤 기본값인지 적는다', () => {
    const wardrobe = okOf(parseLayoutImport(doc({}, { name: '옷장', h: null }), base));
    expect(wardrobe.project.items[0].h).toBe(2000);
    expect(wardrobe.warnings.some((w) => w.includes('옷장 기본 높이') && w.includes('2000 mm'))).toBe(true);
    const box = okOf(parseLayoutImport(doc({}, { name: '이상한물건', h: null }), base));
    expect(box.project.items[0].h).toBe(600);
    expect(box.warnings.some((w) => w.includes('기본값 600 mm'))).toBe(true);
  });

  it('결과에 JSON의 단위를 담는다', () => {
    expect(okOf(parseLayoutImport(doc(), base)).unit).toBe('cm');
  });

  it('rotationDeg 90이면 중심 = left + d/2, top + w/2', () => {
    const r = okOf(parseLayoutImport(doc({}, { rotationDeg: 90, left: 0, top: 0 }), base));
    expect([r.project.items[0].x, r.project.items[0].z]).toEqual([1000, 500]);
    const r270 = okOf(parseLayoutImport(doc({}, { rotationDeg: 270, left: 10, top: 20 }), base));
    expect([r270.project.items[0].x, r270.project.items[0].z]).toEqual([1100, 700]);
  });

  it('방 밖으로 나가는 가구는 경고만', () => {
    const r = okOf(parseLayoutImport(doc({}, { left: 300 }), base));
    expect(r.warnings.some((w) => w.includes('방 밖'))).toBe(true);
  });

  it('색은 6색을 돌려 쓴다', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ name: `a${i}`, w: 10, d: 10, h: 10, left: 0, top: 0, rotationDeg: 0 }));
    const r = okOf(parseLayoutImport(doc({ items }), base));
    expect(r.project.items[6].color).toBe(r.project.items[0].color);
    expect(r.project.items[1].color).not.toBe(r.project.items[0].color);
  });
});

describe('parseLayoutImport 거부', () => {
  const bad = (text: string) => errorsOf(parseLayoutImport(text, base));
  it('빈 값, 깨진 JSON, JSON 없음', () => {
    expect(bad('')).toHaveLength(1);
    expect(bad('   ')).toHaveLength(1);
    expect(bad('{"format": ')).toHaveLength(1);
    expect(bad('{ 깨짐 }')).toHaveLength(1);
    expect(bad('그냥 글자')).toHaveLength(1);
  });
  it('format, version, unit 오류', () => {
    expect(bad(doc({ format: 'x' }))).toHaveLength(1);
    expect(bad(doc({ version: 2 }))).toHaveLength(1);
    expect(bad(doc({ unit: 'inch' }))).toHaveLength(1);
  });
  it('방 범위 밖과 단위 혼용(m 값을 cm로)', () => {
    expect(bad(doc({ room: { width: 3.4, depth: 2.8, height: null } })).length).toBe(2); // 34 mm
    expect(bad(doc({ room: { width: 340, depth: 0, height: null } }))).toHaveLength(1);
    expect(bad(doc({ room: { width: -340, depth: 280, height: null } }))).toHaveLength(1);
    expect(bad(doc({ room: { width: 340, depth: 280, height: 100 } }))).toHaveLength(1);
    expect(bad(doc({ room: { width: 3000, depth: 280, height: null } }))).toHaveLength(1); // 30000 mm
  });
  it('글자 숫자, 가구 범위 밖, 잘못된 회전', () => {
    expect(bad(doc({ room: { width: '340', depth: 280, height: null } }))).toHaveLength(1);
    expect(bad(doc({}, { w: 0 }))).toHaveLength(1);
    expect(bad(doc({}, { d: -5 }))).toHaveLength(1);
    expect(bad(doc({}, { w: 1001 }))).toHaveLength(1);
    expect(bad(doc({}, { h: '높음' }))).toHaveLength(1);
    expect(bad(doc({}, { rotationDeg: 45 }))).toHaveLength(1);
    expect(bad(doc({ items: 'x' }))).toHaveLength(1);
  });
});

describe('가구 종류 짐작과 경고 표기', () => {
  it('이름으로 kind를 넣고, 모르는 이름은 kind를 생략한다', () => {
    const bed = okOf(parseLayoutImport(doc(), base)).project.items[0];
    expect(bed.kind).toBe('bed');
    const other = okOf(parseLayoutImport(doc({}, { name: '화분' }), base)).project.items[0];
    expect('kind' in other).toBe(false);
    const noName = okOf(parseLayoutImport(doc({}, { name: '' }), base)).project.items[0];
    expect(noName.kind).toBeUndefined();
  });

  it('경고와 오류에 "N번 가구(이름)"을 쓰고 items[ 표기는 없다', () => {
    const w = okOf(parseLayoutImport(doc({}, { h: null }), base));
    expect(w.warnings.some((m) => m.startsWith('1번 가구(침대)'))).toBe(true);
    const e = errorsOf(parseLayoutImport(doc({}, { w: 0 }), base));
    expect(e.some((m) => m.startsWith('1번 가구(침대)'))).toBe(true);
    expect([...w.warnings, ...e].some((m) => m.includes('items['))).toBe(false);
  });
});
