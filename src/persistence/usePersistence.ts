// 프로젝트 자동 저장과 시작 때 불러오기. App에서 usePersistence()를 한 번 부른다.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { usePhotoStore } from '../photo/photoStore';
import { useProjectStore } from '../store/projectStore';
import { parseSavedProject, serializeProject, STORAGE_KEY } from './savedProject';
import { readShareHash } from './shareLink';

/**
 * 자동 저장 상태(헤더의 "자동 저장됨" 표시, 2026-11-19 QA 4-2).
 * idle: 이번에 연 뒤 아직 바뀐 것이 없음, pending: 바뀌어 저장을 기다림, saved: 저장됨, failed: 브라우저가 저장을 막음.
 */
export type SaveStatus = 'idle' | 'pending' | 'saved' | 'failed';
export const useSaveStatus = create<{ status: SaveStatus; shareNote: 'loaded' | 'broken' | null }>()(() => ({ status: 'idle', shareNote: null }));

/** 바뀐 뒤 이 시간 동안 더 바뀌지 않으면 저장한다(끌기 중 연속 변경을 묶음). */
export const SAVE_DELAY_MS = 300;

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(text: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, text);
    return true;
  } catch {
    // 저장소가 없거나 가득 찼다. 저장 없이 계속 동작하고 헤더에 알린다.
    return false;
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

/**
 * 시작 때 불러오기. 주소에 공유 링크(#p=…)가 있으면 이 브라우저의 저장본을 먼저 불러온 뒤 공유된 배치로 바꾼다.
 * 바꾸기는 되돌리기 한 단계라, 되돌리면 이 브라우저에서 쓰던 배치로 돌아간다(2026-11-19 QA 5-2).
 * 공유 링크는 한 번 읽으면 주소에서 지운다(새로 고침해도 다시 덮어쓰지 않게).
 */
export function loadStartProject(): void {
  loadSavedProject();
  const shared = readShareHash();
  if (shared === undefined) return;
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    // 주소를 바꿀 수 없는 화면이면 그대로 둔다.
  }
  if (shared === null) {
    useSaveStatus.setState({ shareNote: 'broken' });
    return;
  }
  useProjectStore.getState().replaceProject(shared);
  // 열어 둔 공유 배치가 새로 고침 뒤에도 남도록 바로 저장한다(전에 쓰던 배치는 되돌리기로 돌아갈 수 있다).
  const ok = writeStorage(serializeProject(useProjectStore.getState().project));
  useSaveStatus.setState({ shareNote: 'loaded', status: ok ? 'saved' : 'failed' });
}

/** 프로젝트가 바뀔 때마다 저장한다. 해제 함수를 돌려준다. 해제할 때 밀린 저장을 먼저 끝낸다. */
export function startAutoSave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    const ok = writeStorage(serializeProject(useProjectStore.getState().project));
    useSaveStatus.setState({ status: ok ? 'saved' : 'failed' });
  };
  const unsubscribe = useProjectStore.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
    if (useSaveStatus.getState().status !== 'pending') useSaveStatus.setState({ status: 'pending' });
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
  useState(loadStartProject);
  useEffect(() => {
    void usePhotoStore.getState().restore();
    return startAutoSave();
  }, []);
}
