// 프로젝트 자동 저장과 시작 때 불러오기. App에서 usePersistence()를 한 번 부른다.
import { useEffect, useState } from 'react';
import { usePhotoStore } from '../photo/photoStore';
import { useProjectStore } from '../store/projectStore';
import { parseSavedProject, serializeProject, STORAGE_KEY } from './savedProject';

/** 바뀐 뒤 이 시간 동안 더 바뀌지 않으면 저장한다(끌기 중 연속 변경을 묶음). */
export const SAVE_DELAY_MS = 300;

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // 저장소가 없거나 가득 찼다. 저장 없이 계속 동작한다.
  }
}

/** 저장된 프로젝트를 store에 넣는다. 되돌리기 기록에는 넣지 않는다. 불러왔으면 true. */
export function loadSavedProject(): boolean {
  const text = readStorage();
  if (text === null) return false;
  const project = parseSavedProject(text);
  if (project === null) return false;
  useProjectStore.setState({ project, selectedItemId: null, dragPreview: null });
  return true;
}

/** 프로젝트가 바뀔 때마다 저장한다. 해제 함수를 돌려준다. 해제할 때 밀린 저장을 먼저 끝낸다. */
export function startAutoSave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    writeStorage(serializeProject(useProjectStore.getState().project));
  };
  const unsubscribe = useProjectStore.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  });
  // 탭을 닫거나 숨길 때 밀린 저장이 사라지지 않게 한다.
  const onHide = () => flush();
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onHide);
  return () => {
    unsubscribe();
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onHide);
    flush();
  };
}

export function usePersistence(): void {
  // 불러오기는 첫 그림 전에 한다. 마운트 뒤에 store가 바뀌면 R3F Canvas가 만들어지는 중에 갱신되어
  // React 경고("synchronously unmount a root")가 나는 것을 실측했다. 첫 그림 전에는 구독자가 없어 경고가 없다.
  // useState 초기화 함수는 마운트마다 한 번만 돈다(개발 모드 StrictMode에서는 두 번 돌지만 같은 값을 넣을 뿐이다).
  useState(loadSavedProject);
  useEffect(() => {
    void usePhotoStore.getState().restore();
    return startAutoSave();
  }, []);
}
