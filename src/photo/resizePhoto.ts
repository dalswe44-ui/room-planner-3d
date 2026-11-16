// 첨부한 사진을 긴 변 2048px 이하의 JPEG로 줄인다. 원본을 그대로 들고 있으면 모바일에서 메모리를 넘길 수 있다.
// 줄이지 못하면(브라우저가 형식을 못 읽음 등) 원본 파일을 그대로 돌려준다. 이 경우를 호출한 쪽이 알 수 있게 resized로 알린다.
export const PHOTO_MAX_SIDE = 2048;
const JPEG_QUALITY = 0.85;

/** 긴 변이 max 이하가 되는 크기. 이미 작으면 그대로. */
export function fitWithin(width: number, height: number, max: number = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function resizePhoto(file: File): Promise<{ blob: Blob; resized: boolean }> {
  try {
    // imageOrientation 'from-image': 사진의 회전 정보를 반영해 그린다(기기마다 다를 수 있어 실기기 확인 필요).
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { blob: file, resized: false };
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
      return blob ? { blob, resized: true } : { blob: file, resized: false };
    } finally {
      bitmap.close();
    }
  } catch {
    return { blob: file, resized: false };
  }
}
