// 선택한 가구의 복제. 도구 막대와 패널이 함께 쓴다.
import { roomBounds } from '../contracts/room';
import type { FurnitureItem } from '../contracts/types';
import { useProjectStore } from '../store/projectStore';
import { findFreeSpot, footprint, footprintSize } from './placement';

/** 같은 이름·종류·치수·색·회전의 복제본을 원본에서 가장 가까운 빈 자리에 놓고 선택한다. addItem 한 번이라 되돌리기 한 번에 사라진다. */
export function duplicateItem(item: FurnitureItem): string {
  const { project, addItem } = useProjectStore.getState();
  const { sx, sz } = footprintSize(item);
  const spot = findFreeSpot(
    { w: sx, d: sz },
    roomBounds(project.room),
    project.items.map((it) => footprint(it)),
    { x: item.x, z: item.z },
  );
  return addItem({
    name: item.name,
    kind: item.kind,
    w: item.w,
    d: item.d,
    h: item.h,
    color: item.color,
    rotationDeg: item.rotationDeg,
    elevation: item.elevation,
    ...spot,
  });
}
