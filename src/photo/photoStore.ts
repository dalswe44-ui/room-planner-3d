// 첨부한 사진을 메모리에만 둔다(object URL). 새로고침 뒤 유지는 이번 범위 밖.
import { create } from 'zustand';

interface PhotoState {
  url: string | null;
  setFile(file: File): void;
  clear(): void;
}

export const usePhotoStore = create<PhotoState>()((set, get) => ({
  url: null,
  setFile: (file) => {
    const old = get().url;
    if (old) URL.revokeObjectURL(old);
    set({ url: URL.createObjectURL(file) });
  },
  clear: () => {
    const old = get().url;
    if (old) URL.revokeObjectURL(old);
    set({ url: null });
  },
}));
