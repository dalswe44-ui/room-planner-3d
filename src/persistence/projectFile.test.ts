// 2026-11-19 QA 4-2, 5-2: 파일 내보내기·가져오기, 예시 방, 공유 링크
import { describe, expect, it } from 'vitest';
import { computeItemStatuses } from '../furniture/placement';
import { createDefaultProject } from '../store/projectStore';
import { createExampleProject, parseProjectFile, projectFileText } from './projectFile';
import { makeShareLink, parseShareHash } from './shareLink';

describe('프로젝트 파일', () => {
  it('내보낸 글을 다시 읽으면 같은 프로젝트다', () => {
    const p = createExampleProject();
    const text = projectFileText(p);
    expect(JSON.parse(text)).toMatchObject({ format: 'room-planner-project', version: 1 });
    expect(parseProjectFile(text)).toEqual(p);
  });

  it('Project만 담은 파일도 읽는다', () => {
    const p = createExampleProject();
    expect(parseProjectFile(JSON.stringify(p))).toEqual(p);
  });

  it('깨진 파일, 다른 JSON, 범위 밖 값은 null', () => {
    expect(parseProjectFile('{')).toBeNull();
    expect(parseProjectFile('{"hello":1}')).toBeNull();
    const bad = { ...createDefaultProject(), items: [{ id: 'a', name: 'x', w: 0, d: 10, h: 10, x: 0, z: 0, rotationDeg: 0, elevation: 0, color: '#fff' }] };
    expect(parseProjectFile(JSON.stringify(bad))).toBeNull();
  });
});

describe('예시 방', () => {
  it('가구 1개 이상, 모든 길이가 정수, 경고 없음', () => {
    const p = createExampleProject();
    expect(p.items.length).toBeGreaterThan(0);
    for (const it of p.items) for (const k of ['w', 'd', 'h', 'x', 'z'] as const) expect(Number.isInteger(it[k])).toBe(true);
    const st = computeItemStatuses(p.items, p.room, null);
    for (const it of p.items) expect(st[it.id], it.name).toEqual({ overlap: false, outside: false, wall: false, door: false });
  });
});

describe('공유 링크', () => {
  it('링크의 # 뒤를 읽으면 같은 프로젝트다(한글 이름 포함)', () => {
    const p = createExampleProject();
    const url = makeShareLink(p, 'https://example.test/app/');
    expect(url.startsWith('https://example.test/app/#p=')).toBe(true);
    expect(url.slice(url.indexOf('#p=') + 3)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseShareHash(url.slice(url.indexOf('#')))).toEqual(p);
  });

  it('공유 링크가 아니면 undefined, 깨졌으면 null', () => {
    expect(parseShareHash('')).toBeUndefined();
    expect(parseShareHash('#other')).toBeUndefined();
    expect(parseShareHash('#p=@@@')).toBeNull();
    expect(parseShareHash('#p=' + btoa('{"x":1}'))).toBeNull();
  });
});
