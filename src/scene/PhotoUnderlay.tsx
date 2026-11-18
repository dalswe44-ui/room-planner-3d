// 평면 뷰 밑그림(2026-11-19 QA 5-3): 올린 배치도 사진을 방 바닥 위에 반투명하게 깐다. 사진을 방의 폭·깊이에 맞춰 늘린다.
// 가구·벽보다 아래, 바닥보다 위. 누름(레이캐스트)은 받지 않는다.
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { mmToWorld } from '../contracts/coords';
import type { SceneUserData } from './geometry';

const noRaycast = () => {};

export function PhotoUnderlay({ url, opacity, width, depth }: { url: string; opacity: number; width: number; depth: number }) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let alive = true;
    let loaded: Texture | null = null;
    new TextureLoader().load(url, (t) => {
      t.colorSpace = SRGBColorSpace;
      loaded = t;
      if (alive) {
        setTexture(t);
        invalidate();
      } else t.dispose();
    });
    return () => {
      alive = false;
      loaded?.dispose();
      setTexture(null);
    };
  }, [url, invalidate]);
  if (!texture) return null;
  const w = mmToWorld(width);
  const d = mmToWorld(depth);
  return (
    <mesh
      position={[w / 2, 0.0015, d / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
      raycast={noRaycast}
      userData={{ kind: 'underlay' } satisfies SceneUserData}
    >
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
