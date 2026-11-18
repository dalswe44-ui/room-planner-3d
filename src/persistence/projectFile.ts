// 프로젝트 파일 내보내기·가져오기(2026-11-19 QA 4-2, SPEC S-5)와 예시 방(S-3).
import { rectCorners } from '../contracts/room';
import type { Project } from '../contracts/types';
import { parseSavedProject, SAVE_FORMAT, SAVE_VERSION, serializeProject } from './savedProject';

export const PROJECT_FILE_NAME = 'room-plan.json';

/** 내려받을 파일의 내용. 자동 저장과 같은 형식 { format, version, project }다. */
export function projectFileText(project: Project): string {
  return JSON.stringify(JSON.parse(serializeProject(project)), null, 2);
}

/**
 * 가져온 파일을 읽는다. 저장 형식({ format, version, project })과, 그 안의 Project만 담은 파일 둘 다 받는다.
 * 모양·범위·정수 검사는 자동 저장본 불러오기와 같다. 맞지 않으면 null.
 */
export function parseProjectFile(text: string): Project | null {
  const direct = parseSavedProject(text);
  if (direct) return direct;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || (raw as { version?: unknown }).version !== 1) return null;
  return parseSavedProject(JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, project: raw }));
}

/** 텍스트를 파일로 내려받게 한다. */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  downloadBlob(name, new Blob([text], { type }));
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 예시 방(SPEC S-3): 4200 × 3300 × 2400 원룸. 위쪽 벽에 창문, 아래쪽 벽에 문, 가구 5개.
 * 치수는 기본 가구(furniturePresets)의 값이고 서로 겹치지 않으며 문 열림 자리도 비켜 둔다.
 */
export function createExampleProject(): Project {
  return {
    version: 1,
    displayUnit: 'mm',
    room: {
      ceilingHeight: 2400,
      corners: rectCorners(4200, 3300),
      openings: [
        { id: 'example-window', type: 'window', wall: 0, offset: 1500, width: 1200, height: 1200, sill: 900 },
        { id: 'example-door', type: 'door', wall: 2, offset: 2700, width: 900, height: 2100, sill: 0, hinge: 'start', swing: 'normal' },
      ],
      walls: [],
      labels: [{ id: 'example-label', name: '원룸', at: { x: 2100, z: 1650 } }],
      photos: [],
    },
    items: [
      { id: 'example-bed', name: '침대', kind: 'bed', w: 1100, d: 2000, h: 450, x: 3650, z: 1000, rotationDeg: 0, elevation: 0, color: '#d8c7bd' },
      { id: 'example-desk', name: '책상', kind: 'desk', w: 1200, d: 600, h: 720, x: 600, z: 300, rotationDeg: 0, elevation: 0, color: '#cdb693' },
      { id: 'example-chair', name: '의자', kind: 'chair', w: 450, d: 500, h: 850, x: 600, z: 900, rotationDeg: 180, elevation: 0, color: '#a9b0b8' },
      { id: 'example-wardrobe', name: '옷장', kind: 'wardrobe', w: 900, d: 600, h: 2000, x: 3750, z: 3000, rotationDeg: 180, elevation: 0, color: '#e8e1d5' },
      { id: 'example-shelf', name: '책장', kind: 'shelf', w: 800, d: 300, h: 1800, x: 150, z: 1800, rotationDeg: 270, elevation: 0, color: '#b7c2a8' },
    ],
  };
}
