type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export function createSurface(width: number, height: number): HTMLCanvasElement {
  const factory = (globalThis as { __dailyCanvas?: CanvasFactory }).__dailyCanvas;
  if (factory) return factory(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
