'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Tour, AppMode, Position, Flashcard } from '@/types';

declare global {
  interface Window {
    MP_SDK: {
      connect: (iframe: HTMLIFrameElement, sdkKey: string, version?: string) => Promise<MpSdk>;
    };
  }
}

// Matterport SDK types
interface MpSdk {
  Model: {
    getData: () => Promise<{ sid: string }>;
  };
  Mattertag: {
    add: (tags: MattertagDescriptor[]) => Promise<string[]>;
    remove: (ids: string[]) => Promise<void>;
    getData: () => Promise<MattertagData[]>;
  };
  Pointer: {
    intersection: {
      subscribe: (callback: (intersection: IntersectionData) => void) => { cancel: () => void };
    };
  };
  Camera: {
    pose: {
      subscribe: (callback: (pose: CameraPose) => void) => { cancel: () => void };
    };
  };
  on: (event: string, callback: (...args: any[]) => void) => void;
}

interface MattertagDescriptor {
  label: string;
  description: string;
  anchorPosition: { x: number; y: number; z: number };
  stemVector: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number };
}

interface MattertagData {
  sid: string;
  label: string;
  description: string;
  anchorPosition: { x: number; y: number; z: number };
}

interface IntersectionData {
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
}

interface CameraPose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
}

interface MatterportViewerProps {
  tour: Tour;
  mode: AppMode;
  selectedFlashcardId: string | null;
  onSelectFlashcard: (id: string | null) => void;
  onAddFlashcard: (position: Position) => void;
  onDeleteFlashcard: (id: string) => void;
}

export function MatterportViewer({
  tour,
  mode,
  selectedFlashcardId,
  onSelectFlashcard,
  onAddFlashcard,
}: MatterportViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sdk, setSdk] = useState<MpSdk | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastClick, setLastClick] = useState<{ x: number; y: number; z: number } | null>(null);

  const sdkKey = process.env.NEXT_PUBLIC_MATTERPORT_SDK_KEY;
  const modelId = process.env.NEXT_PUBLIC_MATTERPORT_MODEL_ID;

  // Load Matterport SDK script
  useEffect(() => {
    if (!sdkKey) {
      setError('Missing SDK key. Check .env.local');
      return;
    }

    // Check if already loaded
    if (window.MP_SDK) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://static.matterport.com/showcase-sdk/latest.js`;
    script.async = true;
    script.onload = () => {
      console.log('✅ Matterport SDK script loaded');
      setSdkLoaded(true);
    };
    script.onerror = () => {
      setError('Failed to load Matterport SDK script');
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script on cleanup - it should persist
    };
  }, [sdkKey]);

  // Connect to SDK once script is loaded and iframe is ready
  useEffect(() => {
    if (!sdkLoaded || !iframeRef.current || !sdkKey || sdk) return;

    const iframe = iframeRef.current;

    const connectSdk = async () => {
      try {
        console.log('🔄 Connecting to Matterport SDK...');
        const mpSdk = await window.MP_SDK.connect(iframe, sdkKey, '3.10');
        setSdk(mpSdk);
        setIsConnected(true);

        const modelData = await mpSdk.Model.getData();
        console.log('✅ Connected to Matterport model:', modelData.sid);
      } catch (e) {
        console.error('❌ SDK connection failed:', e);
        setError(`Failed to connect: ${e}`);
      }
    };

    // Wait for iframe to be ready
    iframe.onload = () => {
      setTimeout(connectSdk, 2000); // Give showcase time to initialize
    };

    // If iframe already loaded
    if (iframe.contentWindow) {
      setTimeout(connectSdk, 2000);
    }
  }, [sdkLoaded, sdkKey, sdk]);

  // Subscribe to pointer intersections for click-to-add
  useEffect(() => {
    if (!sdk || mode !== 'edit') return;

    const subscription = sdk.Pointer.intersection.subscribe((intersection) => {
      if (intersection?.position) {
        setLastClick(intersection.position);
      }
    });

    return () => subscription.cancel();
  }, [sdk, mode]);

  // Handle click to add flashcard
  const handleAddClick = useCallback(() => {
    if (lastClick && mode === 'edit') {
      // Convert 3D position to our Position format (heading/pitch approximation)
      onAddFlashcard({
        heading: Math.atan2(lastClick.x, lastClick.z) * (180 / Math.PI),
        pitch: Math.atan2(lastClick.y, Math.sqrt(lastClick.x ** 2 + lastClick.z ** 2)) * (180 / Math.PI),
      });
    }
  }, [lastClick, mode, onAddFlashcard]);

  // Embed URL with SDK key and additional params for SDK connection
  const embedUrl = `https://my.matterport.com/show?m=${modelId}&play=1&qs=1&applicationKey=${sdkKey}`;

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Matterport iframe */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="w-full h-full border-0"
        allow="fullscreen; vr; xr"
        allowFullScreen
      />

      {/* Connection status */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full font-medium shadow-lg z-30 ${
        isConnected ? 'bg-green-600 text-white' : error ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black'
      }`}>
        {isConnected ? '✅ SDK Connected' : error ? `❌ ${error}` : '⏳ Connecting to SDK...'}
      </div>

      {/* Mode indicator */}
      {isConnected && (
        <div className={`absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full font-medium shadow-lg z-30 ${
          mode === 'edit' ? 'bg-yellow-500 text-black' : 'bg-blue-600 text-white'
        }`}>
          {mode === 'edit' ? '📝 Click surfaces to add flashcards' : '👁️ View Mode - Click tags to see answers'}
        </div>
      )}

      {/* Add flashcard button when position is selected */}
      {mode === 'edit' && lastClick && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={handleAddClick}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-lg transition-all"
          >
            ➕ Add Flashcard at Selected Position
          </button>
          <div className="text-white text-xs text-center mt-2 bg-black/50 px-2 py-1 rounded">
            Position: x={lastClick.x.toFixed(2)}, y={lastClick.y.toFixed(2)}, z={lastClick.z.toFixed(2)}
          </div>
        </div>
      )}

      {/* Flashcard count */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm z-30">
        🃏 {tour.flashcards.length} flashcards
      </div>
    </div>
  );
}

