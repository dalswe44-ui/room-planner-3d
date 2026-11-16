// Ctrl/Cmd+Z 되돌리기, Ctrl/Cmd+Shift+Z·Ctrl+Y 다시 실행. 입력 칸에서는 브라우저 기본 동작(글자 되돌리기)을 둔다.
import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function handleUndoKey(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return false;
  const key = e.key.toLowerCase();
  const { undo, redo } = useProjectStore.getState();
  if (key === 'z' && !e.shiftKey) undo();
  else if ((key === 'z' && e.shiftKey) || key === 'y') redo();
  else return false;
  e.preventDefault();
  return true;
}

export function useUndoShortcuts(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleUndoKey);
    return () => window.removeEventListener('keydown', handleUndoKey);
  }, []);
}
