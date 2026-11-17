// 배치도 사진 자동 읽기. 순서: claude.ai 아티팩트 안이면 window.claude의 sample 기능 → 아니면 이 앱의 서버 함수(api/read-layout) → 둘 다 없으면 복사·붙여넣기.
// 사진은 보는 사람 자신의 Claude 계정으로만 가고, 앱은 결과 JSON을 parseLayoutImport에 넘겨 검사·미리보기한다.
import { LAYOUT_READER_PROMPT } from '../contracts/layoutImport';

export interface Sample {
  json(prompt: string, options: { images?: Blob[]; modelTier: 'complex'; signal: AbortSignal }): Promise<unknown>;
  limits(): Promise<{ images?: unknown } | null | undefined>;
}

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

/** 이 코드들이면 자동 읽기를 숨기고 대체 경로를 보인다. */
const UNAVAILABLE_CODES = new Set([
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
  'images_unavailable',
]);

export type ReadFailure =
  | { kind: 'unavailable' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const ERROR_MESSAGE: Record<string, string> = {
  rate_limited: '요청이 너무 많아 읽지 못했어요. 잠시 뒤에 다시 읽어 주세요.',
  image_rejected: '이 사진은 읽을 수 없다고 합니다. 다른 사진으로 바꾸거나 다시 읽어 보세요.',
  refused: 'Claude가 이 사진 읽기를 거절했어요. 다른 사진으로 바꿔 보세요.',
  invalid_json: '읽은 결과가 JSON 형식이 아니었어요. 다시 읽어 주세요.',
  upstream_error: 'Claude 쪽에서 오류가 났어요. 다시 읽어 주세요.',
};

// 실제 sample은 호출할 수 있는 함수에 json·limits가 붙은 꼴이다(typeof가 'function'). 객체 꼴도 받는다.
const isSample = (v: unknown): v is Sample =>
  (typeof v === 'function' || (typeof v === 'object' && v !== null)) &&
  typeof (v as Sample).json === 'function' &&
  typeof (v as Sample).limits === 'function';

let samplePromise: Promise<Sample | null> | null = null;

/** window.claude가 있는지(없으면 바로 쓸 수 없음). */
export const hasClaudeHost = (): boolean => typeof window !== 'undefined' && typeof window.claude?.use === 'function';

/** sample 함수를 얻는다. 없거나 null이면 null. 약 10초 뒤 null로 정해질 수 있어 기다리는 동안 pending이다. */
export function getSample(): Promise<Sample | null> {
  if (!hasClaudeHost()) return Promise.resolve(null);
  samplePromise ??= window
    .claude!.use('sample')
    .then((s) => (isSample(s) ? s : null))
    .catch(() => null);
  return samplePromise;
}

const SERVER_URL = './api/read-layout';
let serverPromise: Promise<boolean> | null = null;
let sampleBlocked = false;

/** 이 앱의 서버 함수가 쓸 수 있는지(GET → {available:true}). 실패·404·JSON 아님·false면 없음. */
export function checkServer(): Promise<boolean> {
  serverPromise ??= (async () => {
    try {
      const res = await fetch(SERVER_URL);
      if (!res.ok) return false;
      const body: unknown = await res.json();
      return typeof body === 'object' && body !== null && (body as { available?: unknown }).available === true;
    } catch {
      return false;
    }
  })();
  return serverPromise;
}

/** 테스트용: 캐시를 비운다. */
export function resetSampleCache(): void {
  samplePromise = null;
  serverPromise = null;
  sampleBlocked = false;
}

const SERVER_STATUS_MESSAGE: Record<number, string> = {
  429: '요청이 너무 많아 읽지 못했어요. 잠시 뒤에 다시 읽어 주세요.',
  413: '사진이 너무 큽니다. 더 작은 사진으로 바꿔 주세요.',
  415: 'JPEG, PNG, WebP 사진만 읽을 수 있어요.',
};

/** via가 'server'면 sample이 아니라 서버로 읽었다(화면이 서버 경로로 바뀐다). */
type ReadResult = ({ ok: true; json: string } | ({ ok: false } & ReadFailure)) & { via?: 'server' };

async function readViaServer(photo: Blob, signal: AbortSignal): Promise<ReadResult> {
  try {
    const res = await fetch(SERVER_URL, { method: 'POST', body: photo, headers: { 'content-type': photo.type || 'image/jpeg' }, signal });
    let body: { text?: unknown; error?: unknown } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* JSON이 아닌 응답은 아래에서 오류로 처리 */
    }
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    if (res.ok && typeof body.text === 'string') return { ok: true, json: body.text };
    if (res.status === 503 && body.error === 'no_key') return { ok: false, kind: 'unavailable' };
    return { ok: false, kind: 'error', message: SERVER_STATUS_MESSAGE[res.status] ?? '읽지 못했어요. 다시 읽어 주세요.' };
  } catch {
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    return { ok: false, kind: 'error', message: '읽지 못했어요. 다시 읽어 주세요.' };
  }
}

/** 사용자 동작 직후에 부른다. 성공하면 결과 JSON 문자열을 돌려준다. */
export async function readLayoutPhoto(photo: Blob, signal: AbortSignal): Promise<ReadResult> {
  const sample = sampleBlocked ? null : await getSample();
  if (!sample) return (await checkServer()) ? { ...(await readViaServer(photo, signal)), via: 'server' } : { ok: false, kind: 'unavailable' };
  const r = await readViaSample(sample, photo, signal);
  if (r.ok || r.kind !== 'unavailable') return r;
  // sample을 쓸 수 없다고 판명됐다. 서버가 있으면 같은 사진을 한 번 서버로 보내고, 이 화면에서는 sample을 다시 시도하지 않는다.
  sampleBlocked = true;
  return (await checkServer()) ? { ...(await readViaServer(photo, signal)), via: 'server' } : r;
}

async function readViaSample(sample: Sample, photo: Blob, signal: AbortSignal): Promise<ReadResult> {
  try {
    const limits = await sample.limits();
    if (!limits || !limits.images) return { ok: false, kind: 'unavailable' };
    const answer = await sample.json(LAYOUT_READER_PROMPT, { images: [photo], modelTier: 'complex', signal });
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    return { ok: true, json: JSON.stringify(answer) };
  } catch (e) {
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
    if (code === 'cancelled') return { ok: false, kind: 'cancelled' };
    if (typeof code === 'string' && UNAVAILABLE_CODES.has(code)) return { ok: false, kind: 'unavailable' };
    return { ok: false, kind: 'error', message: (typeof code === 'string' && ERROR_MESSAGE[code]) || '사진을 읽지 못했어요. 다시 읽어 주세요.' };
  }
}
