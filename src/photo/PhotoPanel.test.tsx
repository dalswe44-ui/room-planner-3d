import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAYOUT_READER_PROMPT } from '../contracts/layoutImport';
import { createDefaultProject, useProjectStore } from '../store/projectStore';
import { PhotoPanel } from './PhotoPanel';
import { usePhotoStore } from './photoStore';

const GOOD = JSON.stringify({
  format: 'room-layout',
  version: 1,
  unit: 'cm',
  room: { width: 340, depth: 280, height: null },
  items: [{ name: '침대', w: 100, d: 200, h: 45, left: 0, top: 0, rotationDeg: 0 }],
  notes: ['천장 높이는 적혀 있지 않음'],
});

beforeEach(() => {
  useProjectStore.setState({ project: createDefaultProject() });
  usePhotoStore.setState({ url: null });
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

// 긴 JSON을 한 글자씩 치지 않도록 붙여 넣기로 넣는다
const paste = (text: string) => fireEvent.change(screen.getByTestId('layout-json'), { target: { value: text } });

describe('PhotoPanel', () => {
  it('붙여넣기 → 미리보기 → 확인 → store 반영', async () => {
    render(<PhotoPanel />);
    expect(screen.getByTestId<HTMLButtonElement>('layout-apply').disabled).toBe(true);
    paste('```json\n' + GOOD + '\n```');
    expect(screen.getByTestId('layout-preview').textContent).toContain('침대');
    expect(screen.getByTestId('layout-preview').textContent).toContain('천장 높이는 적혀 있지 않음');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('layout-apply'));
    expect(screen.getByText('지금의 방과 가구가 모두 바뀝니다')).toBeTruthy();
    expect(useProjectStore.getState().project.items).toHaveLength(0); // 확인 전에는 그대로
    await user.click(screen.getByTestId('layout-apply-confirm'));
    const p = useProjectStore.getState().project;
    expect(p.room.corners[2]).toEqual({ x: 3400, z: 2800 });
    expect(p.room.ceilingHeight).toBe(2400);
    expect([p.items[0].x, p.items[0].z]).toEqual([500, 1000]);
    expect(screen.getByTestId('layout-applied')).toBeTruthy();
  });

  it('취소하면 바뀌지 않는다', async () => {
    render(<PhotoPanel />);
    paste(GOOD);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('layout-apply'));
    await user.click(screen.getByTestId('layout-apply-cancel'));
    expect(useProjectStore.getState().project.items).toHaveLength(0);
    expect(screen.queryByTestId('layout-apply-confirm')).toBeNull();
  });

  it('오류가 있으면 이유를 보이고 적용 버튼이 비활성', () => {
    render(<PhotoPanel />);
    paste(GOOD.replace('"cm"', '"m"')); // 단위 혼용: 340 m
    expect(screen.getByTestId('layout-error')).toBeTruthy();
    expect(screen.getByTestId<HTMLButtonElement>('layout-apply').disabled).toBe(true);
    expect(screen.queryByTestId('layout-preview')).toBeNull();
    paste('{ 깨짐');
    expect(screen.getByTestId('layout-error').textContent).toContain('JSON');
  });

  it('사진을 고르면 보이고 지우면 사라진다. 방과 가구는 그대로', async () => {
    render(<PhotoPanel />);
    const user = userEvent.setup();
    await user.upload(screen.getByTestId('photo-file'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(screen.getByTestId<HTMLImageElement>('photo-preview').src).toBe('blob:fake');
    expect(useProjectStore.getState().project.room.corners[1].x).toBe(3600);
    await user.click(screen.getByTestId('photo-remove'));
    expect(screen.queryByTestId('photo-preview')).toBeNull();
  });

  it('복사 성공 시 문구를 클립보드에 쓴다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<PhotoPanel />);
    fireEvent.click(screen.getByTestId('layout-prompt-copy'));
    await screen.findByText('복사했습니다.');
    expect(writeText).toHaveBeenCalledWith(LAYOUT_READER_PROMPT);
  });

  it('복사 실패 시 읽기 전용 textarea로 문구를 보여 준다', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('x')) }, configurable: true });
    render(<PhotoPanel />);
    fireEvent.click(screen.getByTestId('layout-prompt-copy'));
    const ta = await screen.findByTestId<HTMLTextAreaElement>('layout-prompt-text');
    expect(ta.readOnly).toBe(true);
    expect(ta.value).toBe(LAYOUT_READER_PROMPT);
  });
});
