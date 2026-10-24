/**
 * MediaPipe 엔진·모델 파일 목록 (scripts/copy-face-data.mjs가 쓴 catalog.json).
 * 증명사진(얼굴 찾기)과 배경 지우기가 같은 엔진을 쓴다. 보관소는 경로로 보관하므로 한쪽에서 받은 엔진을
 * 다른 쪽에서 다시 받지 않는다.
 */
import type { DataFile } from '../../frame/data';
import catalog from './catalog.json';

/** 내용이 바뀌면 주소도 바뀌게 해 예전 보관본을 쓰지 않는다 */
const versioned = (file: DataFile): DataFile => ({
  ...file,
  path: `${file.path}?v=${file.sha256.slice(0, 12)}`,
});

/** 인식 엔진 (WebAssembly) */
export const MEDIAPIPE_ENGINE = versioned(catalog.engine);
/** 얼굴 점 찾기 모델 (Face Landmarker) */
export const FACE_MODEL = versioned(catalog.model);
/** 사람 영역 나누기 모델 (Selfie Segmenter) */
export const SELFIE_MODEL = versioned(catalog.segmenter);
/** 누른 곳의 물체 나누기 모델 (Interactive Segmenter, MagicTouch) */
export const OBJECT_MODEL = versioned(catalog.objects);
