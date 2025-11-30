// Core types for MindMap 360 Flashcard App

export interface Position {
  // 3D spherical coordinates - these stick to positions in the tour!
  heading: number; // 0-360 degrees horizontal
  pitch: number;   // -90 to 90 degrees vertical
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  position: Position;
  createdAt: number;
  // Visual customization
  color?: string;
  icon?: string;
}

export interface Tour {
  id: string;
  name: string;
  description?: string;
  type: 'matterport' | 'kuula' | 'panorama';
  embedUrl: string;
  tourId: string;
  flashcards: Flashcard[];
  createdAt: number;
  updatedAt: number;
}

export type AppMode = 'view' | 'edit';

export interface AppState {
  tours: Tour[];
  activeTourId: string | null;
  mode: AppMode;
  selectedFlashcardId: string | null;
}

// Utility function to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Parse tour URLs to extract IDs and types
export function parseTourUrl(url: string): { type: Tour['type']; tourId: string } | null {
  // Matterport: https://my.matterport.com/show?m=pxzSigb4rRt
  const matterportMatch = url.match(/matterport\.com\/show\?.*m=([a-zA-Z0-9]+)/);
  if (matterportMatch) {
    return { type: 'matterport', tourId: matterportMatch[1] };
  }

  // Kuula collection: https://kuula.co/share/collection/7KmDm
  const kuulaCollectionMatch = url.match(/kuula\.co\/share\/collection\/([a-zA-Z0-9]+)/);
  if (kuulaCollectionMatch) {
    return { type: 'kuula', tourId: kuulaCollectionMatch[1] };
  }

  // Kuula single post: https://kuula.co/share/7KmDm
  const kuulaPostMatch = url.match(/kuula\.co\/share\/([a-zA-Z0-9]+)/);
  if (kuulaPostMatch) {
    return { type: 'kuula', tourId: kuulaPostMatch[1] };
  }

  return null;
}

// Create embed URL from tour type and ID
export function createEmbedUrl(type: Tour['type'], tourId: string): string {
  if (type === 'matterport') {
    return `https://my.matterport.com/show?m=${tourId}&play=1&qs=1`;
  }
  // Kuula collection embed
  return `https://kuula.co/share/collection/${tourId}?logo=1&info=1&fs=1&vr=0&sd=1&thumbs=1`;
}

// Navigation hotspot for walking between scenes
export interface NavHotspot {
  id: string;
  fromScene: string;  // Scene ID where hotspot is placed
  toScene: string;    // Scene ID to navigate to
  position: Position; // Where the hotspot appears
  label?: string;     // Optional label like "Go to Kitchen"
}

// Multi-scene tour configuration
export interface TourConfig {
  scenes: {
    id: string;
    name: string;
    image: string;
  }[];
  navHotspots: NavHotspot[];
  defaultScene: string;
}

// Default sample tour - single room with multiple viewpoints
export const SAMPLE_TOURS: Omit<Tour, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Kitchen Tour',
    description: 'Matterport sample kitchen - testing flashcard placement',
    type: 'panorama',
    tourId: 'kitchen-tour',
    embedUrl: '/tours/kitchen_sample/Get-Started-Kitchen.jpg',
    flashcards: [],
  },
];

// Tour scenes configuration - Using Matterport sample kitchen images
export const TOUR_SCENES: TourConfig = {
  scenes: [
    // Just the first kitchen image for now - single viewpoint
    { id: 'kitchen1', name: 'Kitchen View', image: '/tours/kitchen_sample/Get-Started-Kitchen.jpg' },
  ],
  navHotspots: [
    // No navigation hotspots yet - single viewpoint
    // We'll add more when you capture multiple spots from the same room
  ],
  defaultScene: 'kitchen1',
};

