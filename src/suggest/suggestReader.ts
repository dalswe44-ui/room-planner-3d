// AI에 추천 배치를 묻는 경로. 순서: claude.ai 아티팩트의 sample → 이 앱의 서버 함수(api/suggest-layout) → 둘 다 없으면 unavailable.
// 이미지는 보내지 않는다. 보내는 것은 목적, 방(벽·문·창문), 가구 이름·크기·자리뿐이다.
import {
  buildSuggestPrompt,
  buildSuggestRepairPrompt,
  type SuggestItem,
  type SuggestRoom,
} from '../contracts/layoutSuggest';
import { getSample, type Sample } from '../photo/layoutReader';

export interface SuggestRequest {
  goal: string;
  room: SuggestRoom;
  items: readonly SuggestItem[];
  /** 첫 답에 문제가 있어 고쳐 달라고 할 때 */
  repair?: { previous: string; problems: string[] };
}

export type SuggestAnswer =
  | { ok: true; text: string; via?: 'server' }
  | { ok: false; kind: 'unavailable' | 'cancelled'; via?: 'server' }
  | { ok: false; kind: 'error'; message: string; via?: 'server' };

/** 이 코드들이면 sample을 쓸 수 없다고 보고 서버로 넘어간다. */
const UNAVAILABLE_CODES = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

const GENERIC = '추천을 만들지 못했어요. 다시 추천받아 주세요.';
const SAMPLE_MESSAGE: Record<string, string> = {
  rate_limited: '요청이 너무 많아 추천을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  upstream_error: 'Claude 쪽에서 오류가 났어요. 다시 추천받아 주세요.',
  refused: 'Claude가 이 요청을 거절했어요. 목적을 바꿔 다시 시도해 주세요.',
};
const SERVER_MESSAGE: Record<number, string> = {
  429: '요청이 너무 많아 추천을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  413: '보낼 내용이 너무 커요. 가구를 줄이거나 목적을 짧게 써 주세요.',
  400: '보낸 내용을 서버가 받지 못했어요. 목적과 가구를 확인하고 다시 시도해 주세요.',
  502: 'Claude 쪽에서 오류가 났어요. 다시 추천받아 주세요.',
};

const SERVER_URL = './api/suggest-layout';
let serverPromise: Promise<boolean> | null = null;
let sampleBlocked = false;

/** 서버 함수를 쓸 수 있는지(GET → {available:true}). 실패·404·JSON 아님·false면 없음. */
export function checkSuggestServer(): Promise<boolean> {
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

/** 테스트용: 서버 확인과 sample 거절 기억을 비운다. */
export function resetSuggestCache(): void {
  serverPromise = null;
  sampleBlocked = false;
}

/** 서버가 같은 지시문을 만들 수 있게 필요한 것만 골라 보낸다. */
function serverBody(req: SuggestRequest) {
  return {
    goal: req.goal,
    room: { corners: req.room.corners, walls: req.room.walls, openings: req.room.openings },
    items: req.items.map((it) => ({ name: it.name, kind: it.kind, w: it.w, d: it.d, h: it.h, x: it.x, z: it.z, rotationDeg: it.rotationDeg })),
    ...(req.repair ? { repair: req.repair } : {}),
  };
}

async function askServer(req: SuggestRequest, signal: AbortSignal): Promise<SuggestAnswer> {
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(serverBody(req)),
      signal,
    });
    let body: { text?: unknown; error?: unknown } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* JSON이 아닌 응답은 아래에서 오류로 처리 */
    }
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    if (res.ok && typeof body.text === 'string') return { ok: true, text: body.text };
    if (res.status === 503 && body.error === 'no_key') return { ok: false, kind: 'unavailable' };
    return { ok: false, kind: 'error', message: SERVER_MESSAGE[res.status] ?? GENERIC };
  } catch {
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    return { ok: false, kind: 'error', message: GENERIC };
  }
}

async function askSample(sample: Sample, req: SuggestRequest, signal: AbortSignal): Promise<SuggestAnswer> {
  const base = buildSuggestPrompt(req.goal, req.room, req.items);
  const prompt = req.repair ? buildSuggestRepairPrompt(base, req.repair.previous, req.repair.problems) : base;
  try {
    const answer = await sample.json(prompt, { modelTier: 'complex', signal });
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    return { ok: true, text: typeof answer === 'string' ? answer : JSON.stringify(answer) };
  } catch (e) {
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
    if (code === 'cancelled') return { ok: false, kind: 'cancelled' };
    if (typeof code === 'string' && UNAVAILABLE_CODES.has(code)) return { ok: false, kind: 'unavailable' };
    return { ok: false, kind: 'error', message: (typeof code === 'string' && SAMPLE_MESSAGE[code]) || GENERIC };
  }
}

/** 사용자 동작 직후에 부른다. 한 번 부르면 AI 호출은 한 번이다(다시 묻기는 부르는 쪽이 정한다). */
export async function askSuggestion(req: SuggestRequest, signal: AbortSignal): Promise<SuggestAnswer> {
  const sample = sampleBlocked ? null : await getSample();
  if (!sample) return (await checkSuggestServer()) ? { ...(await askServer(req, signal)), via: 'server' } : { ok: false, kind: 'unavailable' };
  const r = await askSample(sample, req, signal);
  if (r.ok || r.kind !== 'unavailable') return r;
  // sample을 쓸 수 없다고 판명됐다. 서버가 있으면 한 번 서버로 보내고, 이 화면에서는 sample을 다시 시도하지 않는다.
  sampleBlocked = true;
  return (await checkSuggestServer()) ? { ...(await askServer(req, signal)), via: 'server' } : r;
}
