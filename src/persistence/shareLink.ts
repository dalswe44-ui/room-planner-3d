// 공유 링크: 프로젝트 전체를 주소의 # 뒤에 담는다(2026-11-19 QA 5-2). 서버에 아무것도 올리지 않는다.
// 형식: #p=<저장 형식(savedProject) JSON을 UTF-8 → base64url로 바꾼 글자>. # 뒤는 서버로 보내지지 않는다.
import type { Project } from '../contracts/types';
import { parseSavedProject, serializeProject } from './savedProject';

const PREFIX = '#p=';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** 지금 주소(쿼리까지)에 프로젝트를 담은 공유 링크 */
export function makeShareLink(project: Project, base: string = location.origin + location.pathname + location.search): string {
  return base + PREFIX + toBase64Url(serializeProject(project));
}

/** # 부분에서 프로젝트를 읽는다. 공유 링크가 아니면 undefined, 깨졌으면 null. 검사는 저장본 불러오기와 같다. */
export function parseShareHash(hash: string): Project | null | undefined {
  if (!hash.startsWith(PREFIX)) return undefined;
  const text = fromBase64Url(hash.slice(PREFIX.length));
  return text === null ? null : parseSavedProject(text);
}

export function readShareHash(): Project | null | undefined {
  return typeof location === 'undefined' ? undefined : parseShareHash(location.hash);
}
