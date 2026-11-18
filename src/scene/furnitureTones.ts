// 가구 부품 색. 가구 색(item.color)에서 밝은·어두운 톤을 은은하게 만들고, 천과 손잡이는 고정 색을 쓴다.
// 경고일 때는 모든 톤에 경고색을 섞어 고정 색 부품(크림색 침구 등)도 붉게 보이게 한다.
import { Color, SRGBColorSpace } from 'three';
import type { GrainKind, PartTone } from './furnitureParts';
import { WARNING_COLOR, WARNING_MIX, mixHex } from './geometry';

const CREAM = '#efe8d8';
const PILLOW = '#faf6ec';
const HANDLE = '#5a5148';
/** 책등 색. 채도를 낮춘 네 가지. */
const BOOKS = ['#8c4a3f', '#3f5f7a', '#6d7a4a', '#c0a15a'];

interface Hsl { h: number; s: number; l: number }

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function shifted(base: string, dSat: number, dLight: number): string {
  const hsl: Hsl = { h: 0, s: 0, l: 0 };
  const c = new Color(base);
  c.getHSL(hsl, SRGBColorSpace);
  c.setHSL(hsl.h, clamp01(hsl.s * dSat), clamp01(hsl.l + dLight), SRGBColorSpace);
  return `#${c.getHexString(SRGBColorSpace)}`;
}

/** 이불: 가구 색이 밝으면 한 톤 어둡게, 어두우면 밝게 해 크림색 매트리스와 구분한다. */
function blanketOf(base: string): string {
  const hsl: Hsl = { h: 0, s: 0, l: 0 };
  new Color(base).getHSL(hsl, SRGBColorSpace);
  return shifted(base, 0.7, hsl.l > 0.72 ? -0.14 : 0.16);
}

/** 부품 톤별 "#rrggbb". warning이면 경고색을 섞는다. */
export function toneHexes(base: string, warning: boolean): Record<PartTone, string> {
  const out: Record<PartTone, string> = {
    main: shifted(base, 0.9, 0),
    light: shifted(base, 0.8, 0.05),
    dark: shifted(base, 0.85, -0.08),
    cream: CREAM,
    pillow: PILLOW,
    blanket: blanketOf(base),
    handle: HANDLE,
    book1: BOOKS[0]!,
    book2: BOOKS[1]!,
    book3: BOOKS[2]!,
    book4: BOOKS[3]!,
  };
  if (warning) {
    for (const k of Object.keys(out) as PartTone[]) out[k] = mixHex(out[k], WARNING_COLOR, WARNING_MIX);
  }
  return out;
}

export interface MaterialSpec { roughness: number; metalness: number }

/** 부품 재질 값. 손잡이는 금속처럼, 민무늬 어두운 부품(다리)은 약간 매끈하게, 천은 거칠게 그린다. */
export function materialSpec(tone: PartTone, grain: GrainKind | undefined): MaterialSpec {
  if (tone === 'handle') return { roughness: 0.38, metalness: 0.45 };
  if (grain === 'fabric') return { roughness: 0.95, metalness: 0 };
  if (grain === 'wood') return { roughness: 0.7, metalness: 0 };
  if (tone === 'dark') return { roughness: 0.5, metalness: 0.15 };
  return { roughness: 0.75, metalness: 0 };
}
