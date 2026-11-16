// 사진 한 장을 IndexedDB(idb-keyval)에 보관한다. 기기 밖으로 보내지 않는다.
// IndexedDB가 없거나 막혀 있으면(사생활 보호 모드 등) 조용히 저장 없이 동작한다.
import { del, get, set } from 'idb-keyval';

export const PHOTO_KEY = 'room-planner-3d/photo';

export async function savePhotoBlob(blob: Blob): Promise<boolean> {
  try {
    await set(PHOTO_KEY, blob);
    return true;
  } catch {
    return false;
  }
}

export async function loadPhotoBlob(): Promise<Blob | null> {
  try {
    const v: unknown = await get(PHOTO_KEY);
    return v instanceof Blob ? v : null;
  } catch {
    return null;
  }
}

export async function deletePhotoBlob(): Promise<void> {
  try {
    await del(PHOTO_KEY);
  } catch {
    // 저장소가 없으면 지울 것도 없다.
  }
}
