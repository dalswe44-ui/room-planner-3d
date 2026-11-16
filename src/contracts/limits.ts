// 입력 허용 범위와 기본값(mm). 방 입력, 가구 입력, 배치도 가져오기가 모두 이 값을 쓴다.
// 값은 docs/SPEC.md와 docs/DECISIONS.md를 따른다. 바꿀 때는 이 파일만 고친다.
import type { Mm } from './types';

/** 방 폭·깊이 */
export const ROOM_SIDE_MIN: Mm = 500;
export const ROOM_SIDE_MAX: Mm = 20000;
/** 이 범위를 벗어나면 "단위를 확인하세요" 경고(막지는 않음) */
export const ROOM_SIDE_USUAL_MIN: Mm = 1000;
export const ROOM_SIDE_USUAL_MAX: Mm = 15000;
/** 천장 높이 */
export const CEILING_MIN: Mm = 1800;
export const CEILING_MAX: Mm = 5000;
/** 가구 폭·깊이·높이 */
export const ITEM_SIZE_MIN: Mm = 10;
export const ITEM_SIZE_MAX: Mm = 10000;
/** 이름을 비우면 쓰는 가구 이름 */
export const DEFAULT_ITEM_NAME = '가구';
