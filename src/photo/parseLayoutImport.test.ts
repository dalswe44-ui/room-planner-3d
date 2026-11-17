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

  it('가로·세로가 null이면 오류가 아니라 기본 크기와 경고 (사용자 보고 2026-11-17: TV의 d, 세탁기의 w)', () => {
    const items = [
      { name: 'TV', w: 1.2, d: null, h: null, left: 0, top: 0, rotationDeg: 0 },
      { name: '소파', w: null, d: 0.85, h: null, left: 1, top: 2, rotationDeg: 0 },
    ];
    const r = okOf(parseLayoutImport(doc({ unit: 'm', room: { width: 3.6, depth: 3, height: null }, items }), base));
    const [tv, sofa] = r.project.items;
    expect([tv.w, tv.d]).toEqual([1200, 600]); // 상자 기본 600
    expect([sofa.w, sofa.d]).toEqual([1800, 850]); // 소파 기본 가로 1800
    expect(r.warnings.some((w) => w.includes('1번 가구(TV)') && w.includes('세로') && w.includes('600 mm'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('2번 가구(소파)') && w.includes('가로') && w.includes('소파 기본 크기 1800 mm'))).toBe(true);
  });

  it('단위가 m이면 모든 길이를 mm로 바꾼다', () => {
    const items = [{ name: '침대', w: 1.1, d: 2, h: 0.45, left: 0.5, top: 0, rotationDeg: 0 }];
    const r = okOf(parseLayoutImport(doc({ unit: 'm', room: { width: 3.6, depth: 3, height: 2.4 }, items }), base));
    expect(r.project.room.corners[2]).toEqual({ x: 3600, z: 3000 });
    expect(r.project.room.ceilingHeight).toBe(2400);
    expect(r.project.items[0]).toMatchObject({ w: 1100, d: 2000, h: 450, x: 1050, z: 1000 });
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
  // 오류가 정확히 1개이고 그 문구에 expected가 모두 들어 있어야 한다.
  const expectOne = (errs: string[], ...expected: string[]) => {
    expect(errs).toHaveLength(1);
    for (const e of expected) expect(errs[0]).toContain(e);
  };
  const room = (width: unknown, depth: unknown, height: unknown = null, unit = 'cm') => doc({ unit, room: { width, depth, height } });

  it('빈 값, 깨진 JSON, JSON 없음', () => {
    expectOne(bad(''), '붙여 넣은 내용이 없습니다');
    expectOne(bad('   '), '붙여 넣은 내용이 없습니다');
    expectOne(bad('{"format": '), 'JSON');
    expectOne(bad('{ 깨짐 }'), '깨져');
    expectOne(bad('그냥 글자'), 'JSON을 찾을 수 없습니다');
  });
  it('format, version, unit 오류', () => {
    expectOne(bad(doc({ format: 'x' })), 'format');
    expectOne(bad(doc({ version: 2 })), 'version');
    expectOne(bad(doc({ unit: 'inch' })), 'unit');
  });
  it('방 범위 밖과 단위 혼용(m 값을 cm로)', () => {
    const mixed = bad(room(3.4, 2.8)); // 34 mm
    expect(mixed).toHaveLength(2);
    expect(mixed[0]).toContain('room.width');
    expect(mixed[1]).toContain('room.depth');
    expectOne(bad(room(340, 0)), 'room.depth');
    expectOne(bad(room(-340, 280)), 'room.width');
    expectOne(bad(room(340, 280, 100)), 'room.height');
    expectOne(bad(room(3000, 280)), 'room.width'); // 30000 mm
  });
  it('글자 숫자, 가구 범위 밖, 잘못된 회전', () => {
    expectOne(bad(room('340', 280)), 'room.width');
    expectOne(bad(doc({}, { w: 0 })), '1번 가구', '.w:');
    expectOne(bad(doc({}, { d: -5 })), '1번 가구', '.d:');
    expectOne(bad(doc({}, { w: 1001 })), '1번 가구', '.w:');
    expectOne(bad(doc({}, { h: '높음' })), '1번 가구', '.h:');
    expectOne(bad(doc({}, { rotationDeg: 45 })), '1번 가구', 'rotationDeg');
    expectOne(bad(doc({ items: 'x' })), 'items');
  });
  it('오류는 해당 가구 번호를 가리킨다', () => {
    const second = { name: '책상', w: 0, d: 50, h: 70, left: 0, top: 0, rotationDeg: 0 };
    const first = { name: '침대', w: 100, d: 200, h: 45, left: 0, top: 0, rotationDeg: 0 };
    expectOne(bad(doc({ items: [first, second] })), '2번 가구(책상)', '.w:');
  });

  describe('경계값', () => {
    it('가구 상한 10000 mm는 받고 10001 mm는 거부한다 (mm)', () => {
      const ok = (w: number) => parseLayoutImport(doc({ unit: 'mm', room: { width: 20000, depth: 20000, height: null } }, { w, left: 0, top: 0 }), base);
      expect(okOf(ok(10000)).project.items[0].w).toBe(10000);
      expectOne(errorsOf(ok(10001)), '1번 가구', '.w:');
    });
    it('가구 상한 단위 변환 경계: cm 1000은 받고 1000.1은 거부', () => {
      expect(okOf(parseLayoutImport(doc({}, { w: 1000 }), base)).project.items[0].w).toBe(10000);
      expectOne(errorsOf(parseLayoutImport(doc({}, { w: 1000.1 }), base)), '1번 가구', '.w:'); // 10001 mm
    });
    it('가구 상한 m 10은 받고 10.001은 거부', () => {
      const m = (w: number) => parseLayoutImport(doc({ unit: 'm', room: { width: 20, depth: 20, height: null } }, { w, d: 1, h: 1 }), base);
      expect(okOf(m(10)).project.items[0].w).toBe(10000);
      expectOne(errorsOf(m(10.001)), '1번 가구', '.w:');
    });
    it('가구 하한 10 mm는 받고 9 mm는 거부, d와 h도 같은 경계', () => {
      const mm = (item: Record<string, unknown>) => parseLayoutImport(doc({ unit: 'mm', room: { width: 3400, depth: 2800, height: null } }, item), base);
      const it = okOf(mm({ w: 10, d: 10, h: 10 })).project.items[0];
      expect([it.w, it.d, it.h]).toEqual([10, 10, 10]);
      expectOne(errorsOf(mm({ w: 9 })), '1번 가구', '.w:');
      expectOne(errorsOf(mm({ d: 9 })), '1번 가구', '.d:');
      expectOne(errorsOf(mm({ h: 9 })), '1번 가구', '.h:');
      expectOne(errorsOf(mm({ h: 10001 })), '1번 가구', '.h:');
      expect(okOf(mm({ h: 10000 })).project.items[0].h).toBe(10000);
    });
    it('방 한 변 500~20000 mm 경계', () => {
      const r = (width: number, depth: number) => parseLayoutImport(doc({ unit: 'mm', room: { width, depth, height: null }, items: [] }), base);
      const lo = okOf(r(500, 500)).project.room.corners;
      expect(lo[2]).toEqual({ x: 500, z: 500 });
      const hi = okOf(r(20000, 20000)).project.room.corners;
      expect(hi[2]).toEqual({ x: 20000, z: 20000 });
      expectOne(errorsOf(r(499, 500)), 'room.width');
      expectOne(errorsOf(r(500, 499)), 'room.depth');
      expectOne(errorsOf(r(20001, 500)), 'room.width');
      expectOne(errorsOf(r(500, 20001)), 'room.depth');
    });
    it('천장 1800~5000 mm 경계', () => {
      const r = (height: number) => parseLayoutImport(doc({ unit: 'mm', room: { width: 3400, depth: 2800, height } }, { w: 100, d: 100, h: 100 }), base);
      expect(okOf(r(1800)).project.room.ceilingHeight).toBe(1800);
      expect(okOf(r(5000)).project.room.ceilingHeight).toBe(5000);
      expectOne(errorsOf(r(1799)), 'room.height');
      expectOne(errorsOf(r(5001)), 'room.height');
    });
  });
});

describe('가구 종류 짐작과 경고 표기', () => {
  it('이름으로 kind를 넣고, 모르는 이름은 kind를 생략한다', () => {
    const bed = okOf(parseLayoutImport(doc(), base)).project.items[0];
    expect(bed.kind).toBe('bed');
    const other = okOf(parseLayoutImport(doc({}, { name: '화분' }), base)).project.items[0];
    expect(other.kind ?? 'box').toBe('box');
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
