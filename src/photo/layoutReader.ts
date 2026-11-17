// 배치도 사진 자동 읽기. claude.ai 아티팩트 안에서 열렸을 때만 window.claude의 sample 기능을 쓴다.
// 사진은 보는 사람 자신의 Claude 계정으로만 가고, 앱은 결과 JSON을 parseLayoutImport에 넘겨 검사·미리보기한다.
import { LAYOUT_READER_PROMPT } from '../contracts/layoutImport';

interface Sample {
  json(prompt: string, options: { images: Blob[]; modelTier: 'default'; signal: AbortSignal }): Promise<unknown>;
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

const isSample = (v: unknown): v is Sample =>
  typeof v === 'object' && v !== null && typeof (v as Sample).json === 'function' && typeof (v as Sample).limits === 'function';

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

/** 테스트용: 캐시를 비운다. */
export function resetSampleCache(): void {
  samplePromise = null;
}

/** 사용자 동작 직후에 부른다. 성공하면 결과 JSON 문자열을 돌려준다. */
export async function readLayoutPhoto(photo: Blob, signal: AbortSignal): Promise<{ ok: true; json: string } | ({ ok: false } & ReadFailure)> {
  try {
    const sample = await getSample();
    if (!sample) return { ok: false, kind: 'unavailable' };
    const limits = await sample.limits();
    if (!limits || !limits.images) return { ok: false, kind: 'unavailable' };
    const answer = await sample.json(LAYOUT_READER_PROMPT, { images: [photo], modelTier: 'default', signal });
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
