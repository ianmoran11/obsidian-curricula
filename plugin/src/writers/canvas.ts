import type { Curriculum, LessonSpec } from '../interfaces';

interface CanvasNode {
  id: string;
  type: 'file';
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasEdge {
  id: string;
  from: { id: string; side: string };
  to: { id: string; side: string };
}

interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const NODE_WIDTH = 320;
const NODE_HEIGHT = 200;
const X_STEP = 400;
const Y_STEP = 240;
const GRID_COLS = 5;

export function generateCanvas(curriculum: Curriculum): string {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const lessonToNodeId = new Map<string, { nodeId: string; x: number; y: number }>();

  for (let modIdx = 0; modIdx < curriculum.modules.length; modIdx++) {
    const module = curriculum.modules[modIdx];
    const x = modIdx * X_STEP;

    for (let lessonIdx = 0; lessonIdx < module.lessons.length; lessonIdx++) {
      const lesson = module.lessons[lessonIdx];
      const y = lessonIdx * Y_STEP;
      const nodeId = `node-${modIdx}-${lessonIdx}`;

      const lessonFileName = slugifyForCanvas(lesson.title);
      const filePath = `4-Curriculum/${slugifyForCanvas(module.title)}/${lessonFileName}.md`;

      nodes.push({
        id: nodeId,
        type: 'file',
        file: filePath,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });

      lessonToNodeId.set(lesson.id, { nodeId, x, y });

      for (const prereqId of lesson.prerequisiteLessonIds) {
        const prereq = lessonToNodeId.get(prereqId);
        if (prereq) {
          edges.push({
            id: `edge-${prereq.nodeId}-${nodeId}`,
            from: { id: prereq.nodeId, side: 'bottom' },
            to: { id: nodeId, side: 'top' },
          });
        }
      }
    }
  }

  const canvas: CanvasData = { nodes, edges };
  return JSON.stringify(canvas, null, 2);
}

function slugifyForCanvas(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}