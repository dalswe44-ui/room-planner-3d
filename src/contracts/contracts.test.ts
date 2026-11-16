// 계약 테스트. 단위와 좌표 규약을 고정한다. 이 파일은 헤드만 고친다.
import { describe, expect, it } from 'vitest';
import { formatLength, formatLengthWithUnit, lengthToMm, parseLength } from './units';
import { mmToWorld, roomToWorld, worldToMm, worldToRoom } from './coords';
import { rectCorners, roomBounds } from './room';
import type { DisplayUnit } from './types';
import { FURNITURE_PRESETS, KIND_LABEL, guessKindFromName, presetFor } from './furniturePresets';

describe('parseLength', () => {
  it('단위가 없으면 fallback 단위로 읽는다', () => {
    expect(parseLength('1200', 'mm')).toBe(1200);
    expect(parseLength('120', 'cm')).toBe(1200);
    expect(parseLength('1.2', 'm')).toBe(1200);
  });

  it('숫자 뒤에 붙인 단위가 fallback보다 우선한다', () => {
    expect(parseLength('120cm', 'mm')).toBe(1200);
    expect(parseLength('1.2m', 'mm')).toBe(1200);
    expect(parseLength('1200mm', 'm')).toBe(1200);
  });

  it('공백과 대문자를 허용한다', () => {
    expect(parseLength('  1.2 M ', 'mm')).toBe(1200);
    expect(parseLength('120 CM', 'mm')).toBe(1200);
  });

  it('가장 가까운 정수 mm로 반올림한다', () => {
    expect(parseLength('1.005m', 'mm')).toBe(1005);
    expect(parseLength('12.34cm', 'mm')).toBe(123);
    expect(parseLength('0.4', 'mm')).toBe(0);
    expect(parseLength('2.675m', 'mm')).toBe(2675);
  });

  it('입력 도중의 "1." 과 ".5" 를 숫자로 읽는다', () => {
    expect(parseLength('1.', 'm')).toBe(1000);
    expect(parseLength('.5', 'm')).toBe(500);
  });

  it('0은 0으로 돌려준다', () => {
    expect(parseLength('0', 'mm')).toBe(0);
  });

  it('빈 값, 글자, 음수, 알 수 없는 단위, 단위 혼용은 null', () => {
    for (const bad of ['', '   ', 'abc', '-100', '12ft', '1m20cm', '1,200', '1.2.3', 'cm', '１２００']) {
      expect(parseLength(bad, 'mm'), bad).toBeNull();
    }
  });
});

describe('formatLength', () => {
  it('mm는 정수, cm는 소수 1자리, m는 소수 3자리', () => {
    expect(formatLength(1200, 'mm')).toBe('1200');
    expect(formatLength(1200, 'cm')).toBe('120.0');
    expect(formatLength(1200, 'm')).toBe('1.200');
    expect(formatLength(1205, 'cm')).toBe('120.5');
    expect(formatLength(1, 'm')).toBe('0.001');
  });

  it('단위 글자를 붙인 표시', () => {
    expect(formatLengthWithUnit(1200, 'm')).toBe('1.200 m');
  });
});

describe('단위 왕복', () => {
  it('어느 단위로 표시했다가 다시 읽어도 mm 값이 변하지 않는다', () => {
    const units: DisplayUnit[] = ['mm', 'cm', 'm'];
    for (const mm of [0, 1, 9, 10, 999, 1000, 1005, 2675, 3600, 12345, 99999]) {
      for (const unit of units) {
        expect(parseLength(formatLength(mm, unit), unit), `${mm} as ${unit}`).toBe(mm);
      }
    }
  });
});

describe('좌표 변환', () => {
  it('장면은 1 unit = 1 m', () => {
    expect(mmToWorld(1200)).toBe(1.2);
    expect(worldToMm(1.2)).toBe(1200);
  });

  it('worldToMm은 정수 mm로 반올림한다', () => {
    expect(worldToMm(1.2004)).toBe(1200);
    expect(worldToMm(1.2005)).toBe(1201);
    expect(Number.isInteger(worldToMm(0.1 + 0.2))).toBe(true);
    expect(worldToMm(0.1 + 0.2)).toBe(300);
  });

  it('mm → 장면 → mm 왕복에서 값이 변하지 않는다', () => {
    for (const mm of [0, 1, 7, 333, 1000, 2675, 12345]) {
      expect(worldToMm(mmToWorld(mm))).toBe(mm);
    }
  });

  it('방 좌표와 장면 좌표는 축 방향이 같다: +x 폭, +y 위, +z 깊이', () => {
    expect(roomToWorld({ x: 1000, z: 2000 })).toEqual([1, 0, 2]);
    expect(roomToWorld({ x: 1000, z: 2000 }, 500)).toEqual([1, 0.5, 2]);
    expect(worldToRoom(1, 2)).toEqual({ x: 1000, z: 2000 });
  });
});

describe('방 다각형', () => {
  it('직사각형 방의 꼭짓점 순서는 원점 → +x → +x+z → +z', () => {
    expect(rectCorners(3600, 3000)).toEqual([
      { x: 0, z: 0 },
      { x: 3600, z: 0 },
      { x: 3600, z: 3000 },
      { x: 0, z: 3000 },
    ]);
  });

  it('roomBounds는 방의 폭(x)과 깊이(z)를 돌려준다', () => {
    const bounds = roomBounds({ corners: rectCorners(3600, 3000) });
    expect(bounds).toEqual({ minX: 0, maxX: 3600, minZ: 0, maxZ: 3000, width: 3600, depth: 3000 });
  });
});

describe('worldToMm -0 정규화', () => {
  it('작은 음수는 -0이 아니라 0이 된다', () => {
    expect(Object.is(worldToMm(-0.0001), 0)).toBe(true);
  });
});

describe('lengthToMm', () => {
  it('단위에 맞춰 정수 mm로 바꾼다', () => {
    expect(lengthToMm(360, 'cm')).toBe(3600);
    expect(lengthToMm(3.6, 'm')).toBe(3600);
    expect(lengthToMm(1234.4, 'mm')).toBe(1234);
    expect(lengthToMm(0.05, 'cm')).toBe(1);
  });
  it('유한한 수가 아니면 null', () => {
    expect(lengthToMm(Number.NaN, 'mm')).toBeNull();
    expect(lengthToMm(Number.POSITIVE_INFINITY, 'cm')).toBeNull();
  });
});

describe('기본 가구', () => {
  it('종류마다 하나씩 있고 치수는 양의 정수 mm', () => {
    const kinds = FURNITURE_PRESETS.map((p) => p.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const p of FURNITURE_PRESETS) {
      for (const v of [p.w, p.d, p.h]) expect(Number.isInteger(v) && v > 0).toBe(true);
    }
  });
  it('이름으로 종류를 짐작한다', () => {
    expect(guessKindFromName('침대')).toBe('bed');
    expect(guessKindFromName('컴퓨터 책상')).toBe('desk');
    expect(guessKindFromName('수납장 (거실)')).toBe('shelf');
    expect(guessKindFromName('화분')).toBe('box');
  });
});

describe('종류 이름과 기본 치수 찾기', () => {
  it('기본 가구의 이름표와 KIND_LABEL이 같다', () => {
    for (const p of FURNITURE_PRESETS) expect(KIND_LABEL[p.kind]).toBe(p.label);
    expect(KIND_LABEL.box).toBe('상자');
  });
  it('presetFor는 종류의 기본 치수, box는 null', () => {
    expect(presetFor('desk')).toMatchObject({ w: 1200, d: 600, h: 720 });
    expect(presetFor('box')).toBeNull();
  });
});
