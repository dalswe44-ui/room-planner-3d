// 첨부한 사진. 화면에는 object URL로 보이고, 줄인 JPEG는 IndexedDB에 보관해 새로고침 뒤에도 남는다(src/persistence/photoBlob.ts).
import { create } from 'zustand';
import { deletePhotoBlob, loadPhotoBlob, savePhotoBlob } from '../persistence/photoBlob';
import { resizePhoto } from './resizePhoto';

/** 평면 뷰 밑그림 설정(2026-11-19 QA 5-3). 프로젝트가 아니라 이 브라우저의 화면 설정이다. */
export interface UnderlaySettings {
  visible: boolean;
  /** 0.1 ~ 1 */
  opacity: number;
}
const UNDERLAY_KEY = 'room-planner-3d/underlay';
export const DEFAULT_UNDERLAY: UnderlaySettings = { visible: false, opacity: 0.5 };

function readUnderlay(): UnderlaySettings {
  try {
    const v = JSON.parse(localStorage.getItem(UNDERLAY_KEY) ?? 'null') as Partial<UnderlaySettings> | null;
    if (v && typeof v.visible === 'boolean' && typeof v.opacity === 'number' && v.opacity >= 0.1 && v.opacity <= 1) return { visible: v.visible, opacity: v.opacity };
  } catch {
    // 깨진 값이면 기본값
  }
  return DEFAULT_UNDERLAY;
}

interface PhotoState {
  underlay: UnderlaySettings;
  setUnderlay(patch: Partial<UnderlaySettings>): void;
  url: string | null;
  /** 줄여 저장한 사진 그 자체. 자동 읽기에 보낸다. */
  blob: Blob | null;
  /** 보관 상태. 'failed'면 이 탭에서만 보이고 새로고침하면 사라진다. */
  storage: 'none' | 'saving' | 'saved' | 'failed';
  setFile(file: File): Promise<void>;
  /** 시작 때 보관된 사진을 불러온다. */
  restore(): Promise<void>;
  clear(): void;
}

export const usePhotoStore = create<PhotoState>()((set, get) => {
  const show = (blob: Blob, storage: 'saving' | 'saved') => {
    const old = get().url;
    if (old) URL.revokeObjectURL(old);
    set({ url: URL.createObjectURL(blob), blob, storage });
  };
  return {
    underlay: readUnderlay(),
    setUnderlay: (patch) => {
      const next = { ...get().underlay, ...patch };
      next.opacity = Math.min(1, Math.max(0.1, Math.round(next.opacity * 100) / 100));
      set({ underlay: next });
      try {
        localStorage.setItem(UNDERLAY_KEY, JSON.stringify(next));
      } catch {
        // 보관할 수 없으면 이번에만
      }
    },
    url: null,
    blob: null,
    storage: 'none',
    setFile: async (file) => {
      const { blob } = await resizePhoto(file);
      show(blob, 'saving');
      const saved = await savePhotoBlob(blob);
      // 저장하는 사이 다른 사진으로 바뀌었거나 지워졌으면 그 상태를 건드리지 않는다.
      if (get().url !== null) set({ storage: saved ? 'saved' : 'failed' });
    },
    restore: async () => {
      if (get().url !== null) return;
      const blob = await loadPhotoBlob();
      if (blob && get().url === null) show(blob, 'saved');
    },
    clear: () => {
      const old = get().url;
      if (old) URL.revokeObjectURL(old);
      set({ url: null, blob: null, storage: 'none' });
      void deletePhotoBlob();
    },
  };
});
