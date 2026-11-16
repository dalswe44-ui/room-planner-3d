// 가구 하나를 그린다. 상자 메시는 항상 w×d×h 히트 박스(레이캐스트·검증 조회용)이고, 종류가 있으면 그 안에 단순 도형 부품을 그린다. 위치와 크기 계산은 geometry.ts의 furnitureTransform만 쓴다.
import { useCallback, useMemo, useRef } from 'react';
import { Color } from 'three';
import { Edges, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { mmToWorld } from '../contracts/coords';
import type { DragPreview, FurnitureItem } from '../contracts/types';
import { partsForKind, type PartTone } from './furnitureParts';
import { SELECTED_EDGE_COLOR, WARNING_COLOR, furnitureTransform, type SceneUserData } from './geometry';

/** 작은 가구라도 이름표는 이 너비(px)까지는 쓴다. 상자보다 커져도 읽을 수 있게 한다. */
const LABEL_MIN_WIDTH_PX = 56;

interface FurnitureBoxProps {
  item: FurnitureItem;
  /** 끄는 중이면 임시 위치를 준다. 아니면 null. */
  preview: DragPreview | null;
  warning: boolean;
  selected: boolean;
  /** 평면 뷰에서만 상자 위에 이름을 글자로 보인다. */
  showLabel: boolean;
}

export function FurnitureBox({ item, preview, warning, selected, showLabel }: FurnitureBoxProps) {
  const t = furnitureTransform(item, preview ? { x: preview.x, z: preview.z } : undefined);
  const userData: SceneUserData = {
    kind: 'furniture',
    furnitureId: item.id,
    baseColor: item.color,
    shape: item.kind ?? 'box',
    warning,
    selected,
  };
  const parts = useMemo(() => partsForKind(item.kind, item.w, item.d, item.h), [item.kind, item.w, item.d, item.h]);
  const shaped = parts.length > 0;
  const color = warning ? WARNING_COLOR : item.color;
  const tones = useMemo(() => toneColors(color), [color]);
  return (
    <mesh position={t.position} rotation={[0, t.rotationY, 0]} userData={userData}>
      <boxGeometry args={t.size} />
      {shaped ? (
        // 모양이 있는 가구의 상자는 보이지 않는 히트 박스다. 그려지지 않지만 레이캐스트에는 맞는다.
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.7} />
      )}
      {shaped &&
        parts.map((p, i) => (
          // 부품 위치는 바닥면 기준 높이(mm). 상자 중심(= 높이의 절반)에서 잰 값으로 바꾸는 보정은 여기 한 곳이다.
          <mesh
            key={i}
            position={[mmToWorld(p.position[0]), mmToWorld(p.position[1] - item.h / 2), mmToWorld(p.position[2])]}
          >
            <boxGeometry args={[mmToWorld(p.size[0]), mmToWorld(p.size[1]), mmToWorld(p.size[2])]} />
            <meshStandardMaterial color={tones[p.tone]} roughness={0.7} />
          </mesh>
        ))}
      {selected && <Edges color={SELECTED_EDGE_COLOR} lineWidth={2} />}
      {showLabel && (
        <FurnitureLabel name={item.name} size={t.size} rotationY={t.rotationY} />
      )}
    </mesh>
  );
}

const TONE_LIGHTNESS: Record<PartTone, number> = { main: 0, light: 0.07, dark: -0.1 };

/** 부품 색: 가구 색에서 밝기만 약간 다르게 한다. */
function toneColors(base: string): Record<PartTone, Color> {
  const out = {} as Record<PartTone, Color>;
  for (const tone of Object.keys(TONE_LIGHTNESS) as PartTone[]) {
    out[tone] = new Color(base).offsetHSL(0, 0, TONE_LIGHTNESS[tone]);
  }
  return out;
}

interface FurnitureLabelProps {
  name: string;
  /** 회전 전 상자 크기(m): w, h, d */
  size: [number, number, number];
  rotationY: number;
}

/**
 * 상자 윗면 가운데에 이름을 DOM 글자로 띄운다(drei Html, 외부 폰트 없음).
 * 글자 요소는 캔버스를 감싼 요소 안에 붙고, 포인터 이벤트를 받지 않아 끌기와 카메라 조작을 가로채지 않는다.
 * 최대 너비는 상자가 화면에서 차지하는 가로 폭(px)에 맞추고, 넘치는 이름은 말줄임으로 자른다.
 */
function FurnitureLabel({ name, size, rotationY }: FurnitureLabelProps) {
  const invalidate = useThree((s) => s.invalidate);
  const labelRef = useRef<HTMLDivElement | null>(null);

  // Html의 내용은 별도 React 루트에서 늦게 붙는다. 붙은 뒤 한 번 더 그려야 최대 너비가 잡힌다(frameloop="demand").
  const setLabel = useCallback(
    (el: HTMLDivElement | null) => {
      labelRef.current = el;
      if (el) invalidate();
    },
    [invalidate],
  );

  // 평면 뷰(직교 카메라)에서 1 m는 camera.zoom px이다. 화면 가로(+x) 방향의 상자 폭을 구한다.
  const footprintX = Math.abs(Math.cos(rotationY)) * size[0] + Math.abs(Math.sin(rotationY)) * size[2];
  useFrame(({ camera }) => {
    const el = labelRef.current;
    if (!el) return;
    const maxWidth = `${Math.max(Math.floor(footprintX * camera.zoom) - 4, LABEL_MIN_WIDTH_PX)}px`;
    if (el.style.maxWidth !== maxWidth) el.style.maxWidth = maxWidth;
  });

  return (
    <Html
      position={[0, size[1] / 2, 0]}
      center
      zIndexRange={[10, 0]}
      wrapperClass="furniture-label-wrap"
      pointerEvents="none"
    >
      <div ref={setLabel} className="furniture-label" title={name}>
        {name}
      </div>
    </Html>
  );
}
