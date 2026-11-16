// 가구 하나를 상자로 그린다. 위치와 크기 계산은 geometry.ts의 furnitureTransform만 쓴다.
import { Edges } from '@react-three/drei';
import type { DragPreview, FurnitureItem } from '../contracts/types';
import { SELECTED_EDGE_COLOR, WARNING_COLOR, furnitureTransform, type SceneUserData } from './geometry';

interface FurnitureBoxProps {
  item: FurnitureItem;
  /** 끄는 중이면 임시 위치를 준다. 아니면 null. */
  preview: DragPreview | null;
  warning: boolean;
  selected: boolean;
}

export function FurnitureBox({ item, preview, warning, selected }: FurnitureBoxProps) {
  const t = furnitureTransform(item, preview ? { x: preview.x, z: preview.z } : undefined);
  const userData: SceneUserData = {
    kind: 'furniture',
    furnitureId: item.id,
    baseColor: item.color,
    warning,
    selected,
  };
  return (
    <mesh position={t.position} rotation={[0, t.rotationY, 0]} userData={userData}>
      <boxGeometry args={t.size} />
      <meshStandardMaterial color={warning ? WARNING_COLOR : item.color} roughness={0.7} />
      {selected && <Edges color={SELECTED_EDGE_COLOR} lineWidth={2} />}
    </mesh>
  );
}
