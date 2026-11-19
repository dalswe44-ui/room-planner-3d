// 배치도 사진 읽기 서버 함수 (Vercel Functions, 웹 표준 Request/Response).
// 앱이 Claude 화면 밖(공개 호스팅)에서 열렸을 때 쓴다. API 키는 이 서버의 환경 변수에만 있고 앱 코드에는 없다.
// 결정: docs/DECISIONS.md 2026-11-17 "배치도 자동 읽기 서버".
//
// GET  → { available: boolean }  (키가 설정되어 있는지만 알려 준다)
// POST → 몸체는 사진 그대로(image/jpeg | image/png | image/webp), 응답은 { text } (AI가 돌려준 원문. 앱이 검사한다)
// 실패 응답은 { error: 코드, message } 와 상태 코드: 503 no_key, 413 too_large, 415 bad_type, 429 rate_limited, 403 bad_origin, 502 upstream
import { LAYOUT_READER_PROMPT } from '../src/contracts/layoutImport.js';

const MAX_BYTES = 4 * 1024 * 1024; // 서버 함수의 요청 몸체 한도(4.5 MB)보다 작게. 앱은 긴 변 2048 px JPEG를 보낸다.
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_MODEL = 'claude-sonnet-5-5';

// 같은 서버 인스턴스 안에서만 세는 간단한 횟수 제한(인스턴스가 바뀌면 초기화된다).
// 비용의 진짜 안전장치는 Claude Console의 월 지출 한도다(README 참고).
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, now: number, store = hits): boolean {
  const recent = (store.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    store.set(key, recent);
    return true;
  }
  recent.push(now);
  store.set(key, recent);
  return false;
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function fail(status: number, error: string, message: string): Response {
  return json(status, { error, message });
}

export interface Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  READ_LIMIT_PER_HOUR?: string;
}

/**
 * 두 서버 함수가 함께 쓰는 앞단 검사: GET 응답, 키 확인, 출처 확인, 횟수 제한.
 * 통과하면 키를, 아니면 돌려줄 응답을 준다.
 */
export function precheck(request: Request, env: Env, now: number): { key: string } | Response {
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (request.method === 'GET') return json(200, { available: Boolean(key) });
  if (request.method !== 'POST') return fail(405, 'method', 'GET 또는 POST만 받습니다.');
  if (!key) return fail(503, 'no_key', '서버에 API 키가 설정되어 있지 않습니다.');

  // 다른 사이트의 페이지가 이 서버를 쓰지 못하게 한다(브라우저가 보내는 Origin이 이 서버와 다르면 거절).
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return fail(403, 'bad_origin', '이 앱에서만 쓸 수 있습니다.');
  }

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const limit = Number(env.READ_LIMIT_PER_HOUR ?? 20) || 20;
  if (rateLimited(ip, limit, now)) return fail(429, 'rate_limited', '잠시 뒤에 다시 시도해 주세요.');
  return { key };
}

/** Claude에 한 번 묻고 글만 뽑아 { text }로 돌려준다. content는 messages API의 user content. */
export async function askClaude(env: Env, key: string, content: unknown, fetchImpl: typeof fetch): Promise<Response> {
  const upstream = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    }),
  }).catch(() => null);

  if (!upstream) return fail(502, 'upstream', 'AI에 연결하지 못했습니다.');
  if (upstream.status === 429) return fail(429, 'rate_limited', 'AI 사용량이 많습니다. 잠시 뒤에 다시 시도해 주세요.');
  if (!upstream.ok) return fail(502, 'upstream', `AI가 오류를 돌려주었습니다 (${upstream.status}).`);

  const data = (await upstream.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
  const text = (data?.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n')
    .trim();
  if (!text) return fail(502, 'upstream', 'AI가 빈 답을 돌려주었습니다.');
  return json(200, { text });
}

export async function handle(request: Request, env: Env, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  const checked = precheck(request, env, now);
  if (checked instanceof Response) return checked;
  const { key } = checked;

  const mediaType = (request.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!MEDIA_TYPES.includes(mediaType)) return fail(415, 'bad_type', 'JPEG, PNG, WebP 사진만 읽을 수 있습니다.');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return fail(413, 'too_large', '사진이 너무 큽니다.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return fail(415, 'bad_type', '사진이 비어 있습니다.');
  if (bytes.byteLength > MAX_BYTES) return fail(413, 'too_large', '사진이 너무 큽니다.');

  return askClaude(
    env,
    key,
    [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: Buffer.from(bytes).toString('base64') } },
      { type: 'text', text: LAYOUT_READER_PROMPT },
    ],
    fetchImpl,
  );
}

export default {
  fetch(request: Request): Promise<Response> {
    return handle(request, process.env as Env);
  },
};
