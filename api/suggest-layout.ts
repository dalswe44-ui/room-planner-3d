// AI 추천 배치 서버 함수 (Vercel Functions, 웹 표준 Request/Response).
// 앱이 Claude 화면 밖(공개 호스팅)에서 열렸을 때 쓴다. API 키는 이 서버의 환경 변수에만 있고 앱 코드에는 없다.
// 결정: docs/DECISIONS.md 2026-11-17 "AI 추천 배치".
//
// GET  → { available: boolean }
// POST → 몸체는 JSON { goal, room: { corners, walls, openings }, items: [...], repair?: { previous, problems } }
//        응답은 { text } (AI가 돌려준 원문. 앱이 검사한다)
// 앱이 보낸 글을 그대로 AI에 넘기지 않는다. 방과 가구의 숫자만 받아 서버가 지시문을 만든다(이 서버를 아무 질문에나 쓰지 못하게).
// 실패 응답은 { error: 코드, message } 와 상태 코드: 503 no_key, 413 too_large, 400 bad_request, 429 rate_limited, 403 bad_origin, 502 upstream
import {
  buildSuggestPrompt,
  buildSuggestRepairPrompt,
  SUGGEST_GOAL_MAX,
  SUGGEST_ITEMS_MAX,
  type SuggestItem,
  type SuggestRoom,
} from '../src/contracts/layoutSuggest.js';
import type { FurnitureKind, InteriorWall, Opening, PointMm } from '../src/contracts/types.js';
import { askClaude, fail, precheck, type Env } from './read-layout.js';

const MAX_BYTES = 64 * 1024;
const NAME_MAX = 40;
const WALLS_MAX = 40;
const OPENINGS_MAX = 40;
const COORD_MAX = 100_000; // mm. 방 한 변 상한보다 넉넉한 값
const PREVIOUS_MAX = 6000;
const PROBLEMS_MAX = 40;
const PROBLEM_TEXT_MAX = 200;
const KINDS: readonly string[] = ['box', 'bed', 'desk', 'chair', 'wardrobe', 'shelf', 'sofa', 'table'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;
const point = (v: unknown): PointMm | null => {
  if (!isRecord(v)) return null;
  const x = num(v.x, -COORD_MAX, COORD_MAX);
  const z = num(v.z, -COORD_MAX, COORD_MAX);
  return x === null || z === null ? null : { x, z };
};
/** 줄바꿈과 따옴표를 없애 지시문의 구조를 흐트러뜨리지 못하게 한다. */
const clean = (s: string, max: number): string => s.replace(/[\r\n"`]+/g, ' ').trim().slice(0, max);

/** 앞선 답에서 가구 자리(번호, back, left, top)만 골라 다시 적는다. 글(reasons 등)은 버려서 아무 글이나 AI에 넘기지 못하게 한다. */
function previousItems(text: string, count: number): string | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    return null;
  }
  if (!isRecord(raw) || !Array.isArray(raw.items) || raw.items.length > count) return null;
  const items = [];
  for (const it of raw.items) {
    if (!isRecord(it)) return null;
    const id = num(it.id, 1, count);
    const left = num(it.left, -COORD_MAX, COORD_MAX);
    const top = num(it.top, -COORD_MAX, COORD_MAX);
    const back = it.back === 'top' || it.back === 'left' || it.back === 'bottom' || it.back === 'right' ? it.back : null;
    if (id === null || left === null || top === null || back === null) return null;
    items.push({ id, back, left, top });
  }
  return JSON.stringify({ format: 'layout-suggestion', version: 1, items });
}

interface Parsed {
  goal: string;
  room: SuggestRoom;
  items: SuggestItem[];
  repair: { previous: string; problems: string[] } | null;
}

/** 몸체를 검사해 지시문에 넣을 값만 골라낸다. 틀리면 null. */
export function parseBody(raw: unknown): Parsed | null {
  if (!isRecord(raw)) return null;
  const goal = typeof raw.goal === 'string' ? clean(raw.goal, SUGGEST_GOAL_MAX) : '';
  if (goal === '') return null;

  const r = raw.room;
  if (!isRecord(r) || !Array.isArray(r.corners) || r.corners.length < 3 || r.corners.length > 16) return null;
  const corners = r.corners.map(point);
  if (corners.some((c) => c === null)) return null;

  const wallsIn = Array.isArray(r.walls) ? r.walls : [];
  const openingsIn = Array.isArray(r.openings) ? r.openings : [];
  if (wallsIn.length > WALLS_MAX || openingsIn.length > OPENINGS_MAX) return null;
  const walls: InteriorWall[] = [];
  for (const w of wallsIn) {
    if (!isRecord(w) || typeof w.id !== 'string') return null;
    const a = point(w.a);
    const b = point(w.b);
    const thickness = num(w.thickness, 1, 1000);
    if (!a || !b || thickness === null) return null;
    walls.push({ id: w.id.slice(0, 64), a, b, thickness });
  }
  const openings: Opening[] = [];
  for (const o of openingsIn) {
    if (!isRecord(o)) return null;
    const type = o.type === 'door' || o.type === 'window' || o.type === 'opening' ? o.type : null;
    const wall = typeof o.wall === 'number' && Number.isInteger(o.wall) && o.wall >= 0 && o.wall < 16 ? o.wall : typeof o.wall === 'string' ? o.wall.slice(0, 64) : null;
    const offset = num(o.offset, 0, COORD_MAX);
    const width = num(o.width, 1, COORD_MAX);
    const height = num(o.height, 1, COORD_MAX);
    const sill = num(o.sill, 0, COORD_MAX);
    if (type === null || wall === null || offset === null || width === null || height === null || sill === null) return null;
    openings.push({
      id: typeof o.id === 'string' ? o.id.slice(0, 64) : '',
      type,
      wall,
      offset,
      width,
      height,
      sill,
      ...(o.hinge === 'end' ? { hinge: 'end' as const } : {}),
      ...(o.swing === 'opposite' ? { swing: 'opposite' as const } : {}),
    });
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > SUGGEST_ITEMS_MAX) return null;
  const items: SuggestItem[] = [];
  for (const it of raw.items) {
    if (!isRecord(it)) return null;
    const name = typeof it.name === 'string' ? clean(it.name, NAME_MAX) : '';
    const w = num(it.w, 1, COORD_MAX);
    const d = num(it.d, 1, COORD_MAX);
    const h = num(it.h, 1, COORD_MAX);
    const x = num(it.x, -COORD_MAX, COORD_MAX);
    const z = num(it.z, -COORD_MAX, COORD_MAX);
    const rotationDeg = num(it.rotationDeg, -3600, 3600);
    if (w === null || d === null || h === null || x === null || z === null || rotationDeg === null) return null;
    const kind = typeof it.kind === 'string' && KINDS.includes(it.kind) ? (it.kind as FurnitureKind) : undefined;
    items.push({ name: name || '가구', ...(kind ? { kind } : {}), w, d, h, x, z, rotationDeg });
  }

  let repair: Parsed['repair'] = null;
  if (raw.repair !== undefined && raw.repair !== null) {
    const rp = raw.repair;
    if (!isRecord(rp) || typeof rp.previous !== 'string' || !Array.isArray(rp.problems)) return null;
    if (rp.previous.length > PREVIOUS_MAX || rp.problems.length === 0 || rp.problems.length > PROBLEMS_MAX) return null;
    if (rp.problems.some((p) => typeof p !== 'string')) return null;
    const previous = previousItems(rp.previous, items.length);
    if (previous === null) return null;
    repair = { previous, problems: (rp.problems as string[]).map((p) => clean(p, PROBLEM_TEXT_MAX)) };
  }
  return { goal, room: { corners: corners as PointMm[], walls, openings }, items, repair };
}

export async function handle(request: Request, env: Env, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  const checked = precheck(request, env, now);
  if (checked instanceof Response) return checked;

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return fail(413, 'too_large', '보낸 내용이 너무 큽니다.');
  const body = await request.text();
  if (body.length > MAX_BYTES) return fail(413, 'too_large', '보낸 내용이 너무 큽니다.');
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return fail(400, 'bad_request', '보낸 내용을 읽을 수 없습니다.');
  }
  const parsed = parseBody(raw);
  if (!parsed) return fail(400, 'bad_request', '목적, 방, 가구 정보가 올바르지 않습니다.');

  const base = buildSuggestPrompt(parsed.goal, parsed.room, parsed.items);
  const prompt = parsed.repair ? buildSuggestRepairPrompt(base, parsed.repair.previous, parsed.repair.problems) : base;
  return askClaude(env, checked.key, [{ type: 'text', text: prompt }], fetchImpl);
}

export default {
  fetch(request: Request): Promise<Response> {
    return handle(request, process.env as Env);
  },
};
