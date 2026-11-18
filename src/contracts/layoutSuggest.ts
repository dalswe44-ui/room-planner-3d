// AI 추천 배치 계약 (2026-11-17 사용자 요청 16:32: "공부하는 환경처럼 배치하고 싶어" 같은 목적을 적으면 AI가 배치를 추천).
// 앱(아티팩트의 sample)과 서버 함수(api/suggest-layout.ts)가 같은 지시문을 쓰도록 여기서 만든다.
// AI는 지금 있는 가구를 옮기고 돌리기만 한다. 가구를 더하거나 빼거나 크기를 바꾸지 않는다.
import { roomNotches } from './room';
import { doorSwingRect, interiorWallRect, openingSpan } from './structure';
import type { FurnitureItem, Mm, Room } from './types';

/** 가구의 뒤(등받이·머리판·벽에 붙는 쪽)가 향하는 벽. 평면 뷰 기준: top은 z=0, left는 x=0. */
export type BackSide = 'top' | 'left' | 'bottom' | 'right';

/** 회전 0일 때 뒤쪽은 -z(위쪽 벽). rotationDeg는 위에서 볼 때 반시계가 양수이므로 90이면 뒤가 왼쪽 벽을 향한다. */
export const BACK_TO_ROTATION: Record<BackSide, 0 | 90 | 180 | 270> = { top: 0, left: 90, bottom: 180, right: 270 };

export function backOfRotation(rotationDeg: number): BackSide {
  const r = ((Math.round(rotationDeg / 90) * 90) % 360 + 360) % 360;
  return r === 90 ? 'left' : r === 180 ? 'bottom' : r === 270 ? 'right' : 'top';
}

export interface LayoutSuggestionItem {
  /** 지시문의 가구 번호(1부터, project.items의 순서) */
  id: number;
  back: BackSide;
  /** 왼쪽 벽에서 가구가 차지하는 사각형의 왼쪽 변까지(mm) */
  left: number;
  /** 위쪽 벽에서 가구가 차지하는 사각형의 위쪽 변까지(mm) */
  top: number;
}

export interface LayoutSuggestion {
  format: 'layout-suggestion';
  version: 1;
  items: LayoutSuggestionItem[];
  /** 왜 이렇게 놓았는지. 사용자에게 그대로 보여 준다. */
  reasons: string[];
  /** 있으면 좋은 가구 등 덧붙이는 말. 앱은 가구를 더하지 않고 글로만 보여 준다. */
  tips: string[];
}

/** 목적 글자 수 상한과 가구 수 상한(서버 함수도 같은 값으로 거절한다). */
export const SUGGEST_GOAL_MAX = 200;
export const SUGGEST_ITEMS_MAX = 40;

export type SuggestRoom = Pick<Room, 'corners' | 'walls' | 'openings'>;
export type SuggestItem = Pick<FurnitureItem, 'name' | 'kind' | 'w' | 'd' | 'h' | 'x' | 'z' | 'rotationDeg'>;

const mm = (v: number): Mm => Math.round(v);

/** 방 꼭짓점의 경계 상자 크기. 지금 방은 직사각형이다. */
/**
 * ㄱ자 방(2026-11-19 QA 5-4)이면 둘러싼 사각형 안에서 방이 아닌 칸을 알리는 줄(끝에 줄바꿈 포함). 직사각형이면 빈 글자라 지시문이 전과 같다.
 */
function notchLines(room: Pick<Room, 'corners'>): string {
  const notches = roomNotches(room.corners);
  if (notches.length === 0) return '';
  const parts = notches.map((n) => `x ${n.minX} ~ ${n.maxX}, z ${n.minZ} ~ ${n.maxZ}`);
  return `- 이 방은 직사각형이 아닙니다. 다음 사각형은 방이 아니므로 가구가 들어가면 안 됩니다: ${parts.join(' / ')}.\n`;
}

export function suggestRoomSize(room: Pick<Room, 'corners'>): { width: Mm; depth: Mm } {
  const xs = room.corners.map((c) => c.x);
  const zs = room.corners.map((c) => c.z);
  return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs) };
}

/** back에 따라 가구가 바닥에서 차지하는 가로·세로(mm). */
export function footprintOfBack(item: Pick<FurnitureItem, 'w' | 'd'>, back: BackSide): { fw: Mm; fd: Mm } {
  return back === 'top' || back === 'bottom' ? { fw: item.w, fd: item.d } : { fw: item.d, fd: item.w };
}

function wallName(o: { wall: number | string }): string {
  if (typeof o.wall === 'string') return '칸막이 벽';
  return ['위쪽 벽', '오른쪽 벽', '아래쪽 벽', '왼쪽 벽'][o.wall] ?? '벽';
}

/** 목적과 지금의 방·가구로 AI에게 줄 지시문을 만든다. 가구 번호는 items의 순서(1부터). */
export function buildSuggestPrompt(goal: string, room: SuggestRoom, items: readonly SuggestItem[]): string {
  const { width, depth } = suggestRoomSize(room);
  const fixed: string[] = [];
  for (const w of room.walls) {
    const r = interiorWallRect(w);
    fixed.push(`- 칸막이 벽: x ${mm(r.minX)}~${mm(r.maxX)}, z ${mm(r.minZ)}~${mm(r.maxZ)} (가구를 겹쳐 놓을 수 없음)`);
  }
  for (const o of room.openings) {
    const span = openingSpan(room, o);
    if (!span) continue;
    const where = `${wallName(o)}의 (${mm(span.from.x)}, ${mm(span.from.z)})~(${mm(span.to.x)}, ${mm(span.to.z)})`;
    if (o.type === 'door') {
      const s = doorSwingRect(room, o);
      const swing = s ? ` 문이 열리는 자리: x ${mm(s.minX)}~${mm(s.maxX)}, z ${mm(s.minZ)}~${mm(s.maxZ)} (가구를 겹쳐 놓을 수 없음)` : '';
      fixed.push(`- 문: ${where}.${swing}`);
    } else if (o.type === 'window') {
      fixed.push(`- 창문: ${where}, 바닥에서 ${mm(o.sill)}~${mm(o.sill + o.height)} 높이 (가구를 놓아도 되지만 창문보다 키 큰 가구로 가리지 않는 편이 좋음)`);
    } else {
      fixed.push(`- 벽의 트인 곳: ${where} (앞을 비워 둠)`);
    }
  }
  const list = items.map((it, i) => {
    const back = backOfRotation(it.rotationDeg);
    const { fw, fd } = footprintOfBack(it, back);
    const kind = it.kind && it.kind !== 'box' ? ` (${it.kind})` : '';
    return `${i + 1}. ${it.name}${kind}: 폭 w ${it.w} × 깊이 d ${it.d} × 높이 ${it.h}. 지금: back "${back}", left ${mm(it.x - fw / 2)}, top ${mm(it.z - fd / 2)}`;
  });

  return `방의 가구 배치를 추천해 주세요. 아래 방과 가구로 사용자의 목적에 맞는 배치를 정하고, 맨 아래 형식의 JSON 하나만 돌려주세요. 설명 문장은 쓰지 마세요.

사용자의 목적: "${goal}"

좌표
- 방을 위에서 내려다본 그림입니다. 길이는 모두 mm입니다.
- 왼쪽 위 모서리가 (0, 0)이고 오른쪽으로 갈수록 x가, 아래쪽으로 갈수록 z가 커집니다.
- 방 크기는 가로(x) ${width}, 세로(z) ${depth}입니다.
- 위쪽 벽은 z = 0, 아래쪽 벽은 z = ${depth}, 왼쪽 벽은 x = 0, 오른쪽 벽은 x = ${width}입니다.
${notchLines(room)}
방에 고정된 것
${fixed.length > 0 ? fixed.join('\n') : '- 없음 (문과 창문 위치를 모릅니다)'}

가구 (번호. 이름: 크기. 지금 자리)
${list.join('\n')}
- w는 가구를 정면에서 본 폭, d는 앞뒤 깊이입니다. 가구의 뒤(back)는 등받이, 머리판, 벽에 붙는 쪽입니다. 침대는 머리판 쪽, 책상은 앉는 사람의 맞은편, 의자·소파는 등받이 쪽, 옷장·책장은 문이나 선반의 반대쪽이 뒤입니다.
- back은 그 뒤쪽이 향하는 벽입니다: "top", "bottom", "left", "right".
- back이 "top"이나 "bottom"이면 가구가 바닥에서 차지하는 사각형은 가로 w × 세로 d이고, "left"나 "right"면 가로 d × 세로 w입니다.
- left는 왼쪽 벽에서 그 사각형의 왼쪽 변까지, top은 위쪽 벽에서 그 사각형의 위쪽 변까지의 거리입니다.

규칙
1. 목록의 가구를 전부, 한 번씩만 씁니다. 가구를 더하거나 빼거나 크기를 바꾸지 않습니다.
2. 모든 가구가 방 안에 있어야 합니다: left ≥ 0, top ≥ 0, left + 가로 ≤ ${width}, top + 세로 ≤ ${depth}.
3. 가구끼리, 가구와 칸막이 벽, 가구와 문이 열리는 자리는 겹치면 안 됩니다. 변이 맞닿는 것은 됩니다.
4. 사람이 쓸 자리를 비웁니다: 문에서 방 안으로 들어오는 길, 침대 옆 한쪽, 옷장·책장의 앞, 책상에 앉는 쪽에 600 이상. 의자는 함께 쓰는 책상이나 식탁의 앉는 쪽에 붙여 놓고 back이 책상 반대쪽을 향하게 합니다.
5. 벽에 기대는 가구(침대, 옷장, 책장, 소파, 책상)는 되도록 back을 벽에 붙입니다(그 벽까지의 거리 0).
6. 목적에 중요한 가구를 먼저 좋은 자리에 놓고 나머지를 맞춥니다. 창문이 있으면 햇빛, 문이 있으면 시선과 동선을 고려합니다. 목적과 상관없는 가구도 쓰기 불편하지 않게 놓습니다.
7. left와 top은 10 단위의 정수입니다.
8. 답하기 전에 가구마다 사각형(left, top, left + 가로, top + 세로)을 계산해 규칙 2와 3을 하나씩 검산합니다. 어긋나면 고친 뒤에 답합니다.
9. reasons에는 왜 이렇게 놓았는지 사용자가 읽을 짧은 문장을 3~6개 씁니다. 목적에 도움이 되는데 방에 없는 가구나 물건이 있으면 tips에 한두 문장으로만 적습니다(없으면 빈 배열).

형식
{
  "format": "layout-suggestion",
  "version": 1,
  "items": [
    { "id": 1, "back": "top", "left": 0, "top": 0 }
  ],
  "reasons": ["책상을 창가에 두어 낮에 밝게 공부할 수 있게 했습니다."],
  "tips": []
}`;
}

/** 첫 답에 문제가 있을 때 한 번 고쳐 달라고 하는 지시문. problems는 앱이 검사해 만든 문장들이다. */
export function buildSuggestRepairPrompt(basePrompt: string, previousJson: string, problems: readonly string[]): string {
  return `${basePrompt}

앞서 아래와 같이 답했지만 검사에서 문제가 나왔습니다.
앞선 답:
${previousJson}

문제:
${problems.map((p) => `- ${p}`).join('\n')}

문제가 난 가구를 옮기거나 돌려서 고치고, 같은 형식의 JSON 전체를 다시 돌려주세요. 문제가 없던 가구는 되도록 그대로 둡니다.`;
}
