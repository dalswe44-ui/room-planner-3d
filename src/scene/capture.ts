// 지금 장면을 PNG로 만드는 연결점(2026-11-19 QA 5-2). SceneView가 함수를 넣고 파일 메뉴가 부른다.
// three.js를 불러오지 않으므로 파일 메뉴가 장면 묶음을 기다리지 않고 가져올 수 있다.
let capturer: (() => Promise<Blob | null>) | null = null;

export function setSceneCapture(fn: (() => Promise<Blob | null>) | null): void {
  capturer = fn;
}

/** 장면이 아직 없으면 null */
export function captureScene(): Promise<Blob | null> {
  return capturer ? capturer() : Promise.resolve(null);
}
