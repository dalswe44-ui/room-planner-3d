// 배치도 가져오기 계약 (방식 ①, docs/DECISIONS.md 2026-11-16).
// 사진이나 손그림 배치도(굿노트 등)를 AI에게 보여 주고, AI가 아래 JSON을 돌려주면
// 사용자가 앱에 붙여 넣고 미리보기를 확인한 뒤 적용한다. 앱은 사진에서 치수를 뽑지 않는다.

/** 배치도 JSON의 길이 단위. 값은 모두 이 단위의 숫자다. */
export type LayoutUnit = 'mm' | 'cm' | 'm';

export interface LayoutImportItem {
  name: string;
  /** 회전 0일 때 가로(왼쪽-오른쪽) 길이 */
  w: number;
  /** 회전 0일 때 세로(위-아래) 길이 */
  d: number;
  /** 높이. 그림에 없으면 null */
  h: number | null;
  /** 왼쪽 벽에서 가구 왼쪽 변까지. 그림에 없으면 null */
  left: number | null;
  /** 위쪽 벽에서 가구 위쪽 변까지. 그림에 없으면 null */
  top: number | null;
  /** 0, 90, 180, 270. 그림에 없으면 0 */
  rotationDeg: 0 | 90 | 180 | 270;
}

export interface LayoutImport {
  format: 'room-layout';
  version: 1;
  unit: LayoutUnit;
  room: {
    /** 가로(왼쪽 벽 ~ 오른쪽 벽) */
    width: number;
    /** 세로(위쪽 벽 ~ 아래쪽 벽) */
    depth: number;
    /** 천장 높이. 그림에 없으면 null */
    height: number | null;
  };
  items: LayoutImportItem[];
  /** AI가 읽지 못했거나 추정한 부분. 사용자에게 그대로 보여 준다. */
  notes: string[];
}

/** 사용자가 배치도 사진과 함께 AI에게 줄 프롬프트. 앱의 "프롬프트 복사" 버튼이 이 문자열을 복사한다. */
export const LAYOUT_READER_PROMPT = `첨부한 그림은 방의 배치도(평면도)입니다. 손으로 그렸거나 사진으로 찍은 것일 수 있습니다.
그림에 적힌 치수를 읽어 아래 형식의 JSON 하나만 돌려주세요. 설명 문장은 쓰지 마세요.

규칙
1. 그림에 숫자로 적힌 값만 씁니다. 자를 대고 잰 것처럼 비율로 추정하지 않습니다. 적혀 있지 않은 값은 null로 둡니다.
2. 단위는 그림에 적힌 단위를 따르고 unit에 "mm", "cm", "m" 중 하나로 적습니다. 단위가 섞여 있으면 하나로 바꿔 씁니다. 단위가 적혀 있지 않으면 숫자의 크기로 판단하고(예: 방 폭이 360이면 cm) notes에 그렇게 판단했다고 적습니다.
3. 그림을 위에서 내려다본 그대로 둡니다. room.width는 그림의 가로(왼쪽 벽~오른쪽 벽), room.depth는 세로(위쪽 벽~아래쪽 벽)입니다.
4. 가구마다 이름, 가로 w, 세로 d(그림에서 보이는 그대로), 높이 h, 왼쪽 벽에서 가구 왼쪽 변까지 left, 위쪽 벽에서 가구 위쪽 변까지 top을 적습니다. 그림이 오른쪽 벽이나 아래쪽 벽에서 잰 거리를 적었다면 방 크기에서 빼서 left, top으로 바꾸고 notes에 적습니다. rotationDeg는 0으로 둡니다.
5. 가구의 변이 벽선에 붙어 그려져 있으면 그 벽까지의 거리는 0으로 봅니다(숫자가 없어도). 오른쪽 벽이나 아래쪽 벽에 붙어 있으면 4번처럼 방 크기에서 빼서 left, top을 구합니다. 이렇게 정한 값은 notes에 적습니다.
6. 화살표나 치수선이 어디에서 어디까지인지 애매하면 가장 그럴듯한 해석을 쓰고 notes에 적습니다.
7. 읽기 어려운 글자, 서로 맞지 않는 치수(가구가 방보다 큼 등), 추정한 것은 모두 notes에 한 줄씩 적습니다.
8. 방이 직사각형이 아니면 바깥을 감싸는 직사각형으로 적고 notes에 적습니다.

형식
{
  "format": "room-layout",
  "version": 1,
  "unit": "cm",
  "room": { "width": 360, "depth": 300, "height": 240 },
  "items": [
    { "name": "침대", "w": 100, "d": 200, "h": 45, "left": 0, "top": 0, "rotationDeg": 0 }
  ],
  "notes": []
}`;
