export const COVER_MODE_THRESHOLD = 900;

export function isCoverMode(viewportWidth: number): boolean {
  return viewportWidth < COVER_MODE_THRESHOLD;
}

export function isInnerMode(viewportWidth: number): boolean {
  return viewportWidth >= COVER_MODE_THRESHOLD;
}

export function getViewportMode(viewportWidth: number): 'inner' | 'cover' {
  return isCoverMode(viewportWidth) ? 'cover' : 'inner';
}

export function isTouchTargetValid(size: number, minSize: number = 48): boolean {
  return size >= minSize;
}

export function isTouchTargetValidBoth(width: number, height: number, minSize: number = 48): boolean {
  return width >= minSize && height >= minSize;
}