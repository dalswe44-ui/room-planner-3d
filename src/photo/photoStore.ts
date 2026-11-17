// 첨부한 사진. 화면에는 object URL로 보이고, 줄인 JPEG는 IndexedDB에 보관해 새로고침 뒤에도 남는다(src/persistence/photoBlob.ts).
import { create } from 'zustand';
import { deletePhotoBlob, loadPhotoBlob, savePhotoBlob } from '../persistence/photoBlob';
import { resizePhoto } from './resizePhoto';

interface PhotoState {
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
