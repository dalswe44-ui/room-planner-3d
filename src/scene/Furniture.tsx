// 가구 하나를 그린다. 상자 메시는 항상 w×d×h 히트 박스(레이캐스트·검증 조회용)이고, 종류가 있으면 그 안에 단순 도형 부품을 그린다. 위치와 크기 계산은 geometry.ts의 furnitureTransform만 쓴다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoxGeometry, Color, EdgesGeometry, LineBasicMaterial, type BufferGeometry } from 'three';
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { mmToWorld } from '../contracts/coords';
import type { DragPreview, FurnitureItem } from '../contracts/types';
import { partsForKind, type FurniturePart, type PartTone } from './furnitureParts';
import { toneHexes } from './furnitureTones';
import { makePartGeometry } from './partGeometry';
import {
  INK_COLOR,
  SELECTED_EDGE_COLOR,
  WARNING_COLOR,
  furnitureTransform,
  type SceneUserData,
} from './geometry';

/** 작은 가구라도 이름표는 이 너비(px)까지는 쓴다. 상자보다 커져도 읽을 수 있게 한다. */
const LABEL_MIN_WIDTH_PX = 56;

interface FurnitureBoxProps {
  item: FurnitureItem;
  /** 끄는 중이면 임시 위치를 준다. 아니면 null. */
  preview: DragPreview | null;
  warning: boolean;
  selected: boolean;
  /** 확정 전 미리보기이면 true. 반투명으로 그리고 바닥 둘레에 노랑 점선을 두른다. */
  draft?: boolean;
  /** 평면 뷰이면 true. 상자 위에 이름을 글자로 보이고, 선택·경고 테두리를 윗면 둘레로 그린다. 3D 뷰에서는 상자의 12개 모서리로 그린다. */
  plan: boolean;
}

/** 미리보기 불투명도 */
const DRAFT_OPACITY = 0.55;

/** 부품 가장자리용 옅은 먹선. 단위 상자 하나를 모든 부품이 크기만 달리해 공유한다. */
const UNIT_BOX_EDGES = new EdgesGeometry(new BoxGeometry(1, 1, 1));
const PART_EDGE_MATERIAL = new LineBasicMaterial({ color: INK_COLOR, transparent: true, opacity: 0.32 });

export function FurnitureBox({ item, preview, warning, selected, draft = false, plan }: FurnitureBoxProps) {
  const t = furnitureTransform(item, preview ? { x: preview.x, z: preview.z } : undefined);
  const userData: SceneUserData = {
    kind: 'furniture',
    furnitureId: item.id,
    baseColor: item.color,
    shape: item.kind ?? 'box',
    warning,
    selected,
    draft,
  };
  const kindParts = useMemo(() => partsForKind(item.kind, item.w, item.d, item.h), [item.kind, item.w, item.d, item.h]);
  // 종류 없는 상자는 둥근 모서리의 덩어리 하나로 그린다.
  const parts = useMemo<FurniturePart[]>(
    () =>
      kindParts.length > 0
        ? kindParts
        : [{ size: [item.w, item.h, item.d], position: [0, item.h / 2, 0], tone: 'main', radius: Math.min(30, item.w / 6, item.d / 6, item.h / 6) }],
    [kindParts, item.w, item.h, item.d],
  );
  // 경고여도 가구 고유색을 남기고 경고색을 섞는다(무슨 가구인지 보이도록). 고정 색 부품에도 섞는다.
  const tones = useMemo(() => {
    const hex = toneHexes(item.color, warning);
    const out = {} as Record<PartTone, Color>;
    for (const k of Object.keys(hex) as PartTone[]) out[k] = new Color(hex[k]);
    return out;
  }, [item.color, warning]);
  // 미리보기는 반투명. 깊이를 쓰지 않아 부품끼리 겹쳐도 한 겹으로 보인다.
  const ghost = draft ? { transparent: true, opacity: DRAFT_OPACITY, depthWrite: false } : {};
  return (
    <mesh position={t.position} rotation={[0, t.rotationY, 0]} userData={userData}>
      <boxGeometry args={t.size} />
      {/* 바깥 상자는 보이지 않는 히트 박스다. 그려지지 않지만 레이캐스트에는 맞는다. */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      {parts.map((p, i) => (
        <PartMesh key={i} part={p} height={item.h} color={tones[p.tone]} ghost={ghost} draft={draft} />
      ))}
      {plan && !draft && <FootprintOutline size={t.size} />}
      {draft && <DraftOutline size={t.size} plan={plan} />}
      {(selected || warning) && <FurnitureOutline size={t.size} plan={plan} selected={selected} warning={warning} />}
      {plan && <FurnitureLabel name={item.name} size={t.size} rotationY={t.rotationY} />}
    </mesh>
  );
}

interface FurnitureOutlineProps {
  /** 회전 전 상자 크기(m): w, h, d */
  size: [number, number, number];
  plan: boolean;
  selected: boolean;
  warning: boolean;
}

/** 윗면 둘레 위로 살짝 띄우는 높이(m) */
const OUTLINE_LIFT = 0.004;

/**
 * 선택(줄자 노랑)과 경고(빨강) 테두리. 화면 픽셀 굵기의 선이라 확대해도 굵기가 같다.
 * 선택은 노랑 선 아래에 먹색 선을 한 겹 더 깔아 밝은 바닥과 가구 위에서 모두 보이게 한다.
 * 평면 뷰는 윗면 둘레만(다른 가구에 가려지지 않게 깊이 검사 없음), 3D 뷰는 바닥 둘레와 윗면 둘레를 가늘게 그린다.
 */
function FurnitureOutline({ size, plan, selected, warning }: FurnitureOutlineProps) {
  const [w, h, d] = size;
  const points = useMemo(() => {
    const x = w / 2;
    const z = d / 2;
    if (plan) {
      const y = h / 2 + OUTLINE_LIFT;
      return [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z], [-x, y, -z]] as [number, number, number][];
    }
    const y = h / 2;
    const c = (sx: number, sy: number, sz: number): [number, number, number] => [sx * x, sy * y, sz * z];
    const out: [number, number, number][] = [];
    // 3D 뷰는 발자국 둘레와 윗면 둘레만 그린다(세로 모서리는 생략해 조용하게).
    for (const sy of [-1, 1]) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]] as const) {
      out.push(c(a[0], sy, a[1]), c(b[0], sy, b[1]));
    }
    return out;
  }, [w, h, d, plan]);
  // 경고 테두리는 깊이 검사를 해서 더 높은 가구에 가려진다. 선택 테두리는 평면 뷰에서 항상 보인다.
  const common = { points, segments: !plan } as const;
  if (!selected) {
    return <Line {...common} color={WARNING_COLOR} lineWidth={2.5} renderOrder={20} />;
  }
  return (
    <>
      <Line {...common} depthTest={!plan} color={warning ? WARNING_COLOR : INK_COLOR} lineWidth={plan ? 6 : 3.5} renderOrder={20} />
      <Line {...common} depthTest={!plan} color={SELECTED_EDGE_COLOR} lineWidth={plan ? 3 : 2} renderOrder={21} />
    </>
  );
}

/** 확정 전 표시: 바닥 둘레(평면 뷰는 윗면 둘레)에 먹색 바탕 위 노랑 점선. */
function DraftOutline({ size, plan }: { size: [number, number, number]; plan: boolean }) {
  const [w, h, d] = size;
  const points = useMemo(() => {
    const x = w / 2;
    const z = d / 2;
    const y = plan ? h / 2 + OUTLINE_LIFT : -h / 2 + OUTLINE_LIFT;
    return [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z], [-x, y, -z]] as [number, number, number][];
  }, [w, h, d, plan]);
  return (
    <Line points={points} depthTest={false} color={SELECTED_EDGE_COLOR} lineWidth={3} dashed dashSize={0.08} gapSize={0.05} renderOrder={22} />
  );
}

interface PartMeshProps {
  part: FurniturePart;
  /** 가구 높이(mm) */
  height: number;
  color: Color;
  ghost: { transparent?: boolean; opacity?: number; depthWrite?: boolean };
  draft: boolean;
}

/** 부품 하나. 위치는 바닥면 기준 높이(mm)이고, 상자 중심(= 높이의 절반)에서 잰 값으로 바꾸는 보정은 여기 한 곳이다. */
function PartMesh({ part, height, color, ghost, draft }: PartMeshProps) {
  const geometry = useMemo<BufferGeometry | undefined>(() => makePartGeometry(part), [part]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const size: [number, number, number] = [mmToWorld(part.size[0]), mmToWorld(part.size[1]), mmToWorld(part.size[2])];
  const sharp = !part.radius && !part.corner;
  return (
    <mesh
      castShadow={!draft}
      receiveShadow={!draft}
      position={[mmToWorld(part.position[0]), mmToWorld(part.position[1] - height / 2), mmToWorld(part.position[2])]}
      {...(geometry ? { geometry } : {})}
    >
      {sharp && <boxGeometry args={size} />}
      <meshStandardMaterial color={color} roughness={0.75} {...ghost} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      {sharp && <lineSegments geometry={UNIT_BOX_EDGES} material={PART_EDGE_MATERIAL} scale={size} dispose={null} />}
    </mesh>
  );
}

/** 평면 뷰에서 밝은 가구가 밝은 바닥에 묻히지 않게 하는 가는 바깥 윤곽(윗면 둘레). 깊이 검사를 해서 다른 가구 아래로는 가려진다. */
function FootprintOutline({ size }: { size: [number, number, number] }) {
  const [w, h, d] = size;
  const points = useMemo(() => {
    const x = w / 2;
    const z = d / 2;
    const y = h / 2 + 0.002;
    return [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z], [-x, y, -z]] as [number, number, number][];
  }, [w, h, d]);
  return <Line points={points} color={INK_COLOR} transparent opacity={0.5} lineWidth={1.2} renderOrder={5} />;
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
  // drei Html은 붙일 요소를 렌더 때마다 events.connected ?? canvas 부모 순으로 고른다. R3F는 events.connected를 첫 그림 뒤에 채우므로,
  // 첫 그림부터 가구가 있으면(새로 고침으로 불러온 경우) 붙일 요소가 바뀌어 Html이 자기 루트를 렌더 중에 내렸다 다시 만든다.
  // 이때 앞 루트의 늦은 해제가 새 루트의 내용을 지운다. 붙일 요소가 정해진 뒤에 Html을 만든다.
  // 또 첫 그림이 React DOM 커밋 안에서 일어나면 Html의 DOM 루트 해제가 "렌더 중"으로 보여 미뤄지므로(개발 모드 StrictMode의 효과 재실행), 한 틱 뒤에 만든다.
  const connected = useThree((s) => s.events.connected);
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = setTimeout(() => setReady(true), 0); return () => clearTimeout(id); }, []);
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

  if (!connected || !ready) return null;
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
