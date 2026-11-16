// 기본 가구 목록. 추가 폼의 "기본 가구" 버튼과 장면의 모양 그리기가 함께 쓴다.
// 치수는 흔한 제품 크기를 어림한 기본값이고, 사용자가 추가 전에 바꿀 수 있다.
import type { FurnitureKind, Mm } from './types';

export interface FurniturePreset {
  kind: FurnitureKind;
  /** 화면 이름이자 추가할 때의 가구 이름 */
  label: string;
  w: Mm;
  d: Mm;
  h: Mm;
}

export const FURNITURE_PRESETS: readonly FurniturePreset[] = [
  { kind: 'bed', label: '침대', w: 1100, d: 2000, h: 450 },
  { kind: 'desk', label: '책상', w: 1200, d: 600, h: 720 },
  { kind: 'chair', label: '의자', w: 450, d: 500, h: 850 },
  { kind: 'wardrobe', label: '옷장', w: 900, d: 600, h: 2000 },
  { kind: 'shelf', label: '책장', w: 800, d: 300, h: 1800 },
  { kind: 'sofa', label: '소파', w: 1800, d: 850, h: 800 },
  { kind: 'table', label: '식탁', w: 1200, d: 800, h: 720 },
];

/** 이름으로 종류를 짐작한다(배치도 가져오기 등). 못 찾으면 'box'. */
export function guessKindFromName(name: string): FurnitureKind {
  const n = name.replace(/\s/g, '');
  const rules: [RegExp, FurnitureKind][] = [
    [/침대|베드|bed/i, 'bed'],
    [/책상|데스크|desk/i, 'desk'],
    [/의자|체어|chair|스툴/i, 'chair'],
    [/옷장|장롱|붙박이|wardrobe|closet/i, 'wardrobe'],
    [/책장|선반|수납장|shelf|bookcase/i, 'shelf'],
    [/소파|쇼파|sofa|couch/i, 'sofa'],
    [/식탁|테이블|table/i, 'table'],
  ];
  for (const [re, kind] of rules) if (re.test(n)) return kind;
  return 'box';
}
