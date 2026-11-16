// 문자열 ↔ mm 변환은 이 파일의 함수만 쓴다. 다른 곳에서 10, 100, 1000을 곱하거나 나누지 않는다.
import type { DisplayUnit, Mm } from './types';

const MM_PER_UNIT: Record<DisplayUnit, number> = { mm: 1, cm: 10, m: 1000 };

export const UNIT_LABEL: Record<DisplayUnit, string> = { mm: 'mm', cm: 'cm', m: 'm' };

export const DISPLAY_UNITS: readonly DisplayUnit[] = ['mm', 'cm', 'm'];

/**
 * 사용자가 입력한 글자를 정수 mm로 바꾼다.
 * - "1200", "120cm", "1.2m", " 1.2 M " 처럼 숫자 뒤에 단위를 붙일 수 있다. 단위가 없으면 fallback 단위로 읽는다.
 * - 가장 가까운 mm로 반올림한다.
 * - 빈 값, 글자, 음수, 알 수 없는 단위는 null을 돌려준다. 0은 0으로 돌려준다(양수여야 하는지는 호출하는 쪽이 정한다).
 */
export function parseLength(input: string, fallback: DisplayUnit): Mm | null {
  const text = input.trim().toLowerCase();
  const match = /^(\d+(?:\.\d*)?|\.\d+)\s*(mm|cm|m)?$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = (match[2] as DisplayUnit | undefined) ?? fallback;
  return Math.round(value * MM_PER_UNIT[unit]);
}

/**
 * 정수 mm를 표시 단위의 숫자 글자로 바꾼다(단위 글자는 붙이지 않는다).
 * mm는 정수, cm는 소수 1자리, m는 소수 3자리. 어느 단위로 표시해도 1mm가 사라지지 않는다.
 */
export function formatLength(mm: Mm, unit: DisplayUnit): string {
  switch (unit) {
    case 'mm':
      return String(Math.round(mm));
    case 'cm':
      return (Math.round(mm) / MM_PER_UNIT.cm).toFixed(1);
    case 'm':
      return (Math.round(mm) / MM_PER_UNIT.m).toFixed(3);
  }
}

/** 단위 글자를 붙인 표시. 예: "1.200 m" */
export function formatLengthWithUnit(mm: Mm, unit: DisplayUnit): string {
  return `${formatLength(mm, unit)} ${UNIT_LABEL[unit]}`;
}
