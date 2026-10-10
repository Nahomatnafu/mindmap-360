// UI-facing types. Persisted data lives in src/lib/model/types.ts and is
// adapted into these browser-ready views by TourContext.
import { createId } from '@/lib/model/ids';

export interface Position {
  heading: number;
  pitch: number;
  sceneId?: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  position: Position;
  createdAt: number;
  color?: string;
  icon?: string;
  imageUrl?: string;
  size?: number;
}

export interface MemoryDraft {
  question: string;
  answer: string;
  color?: string;
  size?: number;
  /** undefined keeps the existing image; null removes it. */
  imageBlob?: Blob | null;
}

export interface TourScene {
  id: string;
  name: string;
  image: string;
  thumbnail?: string;
  alternate?: boolean;
  sortOrder: number;
  initialYaw: number;
  initialPitch: number;
  initialHfov: number;
}

export interface NavHotspot {
  id: string;
  fromScene: string;
  toScene: string;
  position: Position;
  label?: string;
  surface?: 'floor' | 'wall';
  preserveView?: boolean;
}

export interface Tour {
  id: string;
  name: string;
  description?: string;
  type: 'matterport' | 'kuula' | 'panorama';
  embedUrl: string;
  tourId: string;
  flashcards: Flashcard[];
  scenes: TourScene[];
  navHotspots: NavHotspot[];
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export type AppMode = 'view' | 'edit';

export interface AppState {
  tours: Tour[];
  activeTourId: string | null;
  mode: AppMode;
  selectedFlashcardId: string | null;
}

export function generateId(): string {
  return createId();
}

export function parseTourUrl(url: string): { type: Tour['type']; tourId: string } | null {
  const matterportMatch = url.match(/matterport\.com\/show\?.*m=([a-zA-Z0-9]+)/);
  if (matterportMatch) return { type: 'matterport', tourId: matterportMatch[1] };

  const kuulaCollectionMatch = url.match(/kuula\.co\/share\/collection\/([a-zA-Z0-9]+)/);
  if (kuulaCollectionMatch) return { type: 'kuula', tourId: kuulaCollectionMatch[1] };

  const kuulaPostMatch = url.match(/kuula\.co\/share\/([a-zA-Z0-9]+)/);
  if (kuulaPostMatch) return { type: 'kuula', tourId: kuulaPostMatch[1] };

  return null;
}

export function createEmbedUrl(type: Tour['type'], tourId: string): string {
  if (type === 'matterport') {
    return `https://my.matterport.com/show?m=${tourId}&play=1&qs=1`;
  }
  return `https://kuula.co/share/collection/${tourId}?logo=1&info=1&fs=1&vr=0&sd=1&thumbs=1`;
}
