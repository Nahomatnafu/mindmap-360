import type { PalaceWithPayloads, MoveHotspot } from '@/lib/model/types';

// Reviewed against the user's earlier tour manifest and the current photos.
// The current batch is numbered in reverse of OV_Ad_Edited-*.jpg.
const rooms = ['Front Entry', 'Entryway', 'Main Hall', 'Laundry', 'Living & Kitchen', 'Living Room', 'Kitchen', 'Back Patio', 'Backyard'];
const headings = [15, -25, 65, 0, 78, -20, 10, -22, -62];
const pitches = [-30, -12, -15, -12, -15, -15, -15, -18, -15];
const order = [0, 1, 2, 4, 6, 5, 7, 8, 3];
const links: [number, number, number, number, boolean?][] = [
  [0,1,15,-58], [1,2,-26,-36], [1,0,137,-63],
  [2,4,78,-39], [2,1,-98,-48], [2,3,0,-8,true],
  [3,4,78,-39], [3,1,-98,-48], [3,2,0,-8,true],
  [4,2,-12,-35], [4,6,94,-49], [4,5,142,-58],
  [5,7,-58,-38], [5,6,109,-54], [5,4,53,-51],
  [6,5,-153,-48], [6,4,-104,-65],
  [7,5,-25,-54], [7,8,155,-60], [8,7,-69,-42],
];

export function applyOpenViewLayout(bundle: PalaceWithPayloads): PalaceWithPayloads {
  const scenes = rooms.map((name, i) => bundle.scenes.find(s => s.title === name || s.title === `ov batch ${String(i + 1).padStart(2, '0')}`));
  if (bundle.scenes.length !== 9 || scenes.some(s => !s)) throw new Error('This reviewed layout requires the nine original OpenView scenes.');
  const checked = scenes.map(s => s!);
  const movement: MoveHotspot[] = links.map(([from, to, yaw, pitch, toggle]) => ({
    id: `ov-link-${checked[from].id}-${checked[to].id}`,
    sceneId: checked[from].id, kind: 'move', targetSceneId: checked[to].id,
    yaw, pitch, label: toggle ? (to === 3 ? 'Open laundry' : 'Close laundry') : rooms[to],
    iconKey: toggle ? 'reveal' : 'walk', surface: toggle ? 'wall' : 'floor',
    preserveView: Boolean(toggle), color: '#ffffff', size: 56,
  }));
  return {
    ...bundle,
    palace: { ...bundle.palace, startSceneId: checked[0].id },
    scenes: checked.map((scene, i) => ({ ...scene, title: rooms[i], initialYaw: headings[i], initialPitch: pitches[i], initialHfov: 95, sortOrder: order.indexOf(i), alternate: i === 3 })),
    hotspots: [...bundle.hotspots.filter(h => h.kind === 'memory'), ...movement],
  };
}
