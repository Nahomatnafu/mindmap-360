'use client';

import React from 'react';
import { Tour, AppMode } from '@/types';

interface TourSidebarProps {
  tours: Tour[];
  activeTourId: string | null;
  mode: AppMode;
  onSelectTour: (id: string) => void;
  onModeChange: (mode: AppMode) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function TourSidebar({
  tours,
  activeTourId,
  mode,
  onSelectTour,
  onModeChange,
  isOpen,
  onToggle,
}: TourSidebarProps) {
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-40 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-white shadow-xl z-30 transition-transform duration-300
        w-80 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 pt-16">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">🧠 MindMap 360</h1>
          <p className="text-sm text-gray-500 mb-6">Flashcards in Virtual Tours</p>

          {/* Mode Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => onModeChange('view')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  mode === 'view'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                👁️ View
              </button>
              <button
                onClick={() => onModeChange('edit')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  mode === 'edit'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ✏️ Edit
              </button>
            </div>
          </div>

          {/* Tour List */}
          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Your Tours</h2>
            <div className="space-y-2">
              {tours.map(tour => (
                <button
                  key={tour.id}
                  onClick={() => onSelectTour(tour.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    tour.id === activeTourId
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${tour.type === 'matterport' ? '🏠' : '🌐'}`}>
                      {tour.type === 'matterport' ? '🏠' : '🌐'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{tour.name}</div>
                      <div className="text-xs text-gray-500">
                        {tour.flashcards.length} card{tour.flashcards.length !== 1 ? 's' : ''} • {tour.type}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {tours.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No tours yet</p>
                  <p className="text-sm">Sample tours loading...</p>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">How to use</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Select a tour from the list</li>
              <li>• Switch to <strong>Edit</strong> mode to add flashcards</li>
              <li>• Click anywhere on the tour to place a marker</li>
              <li>• Switch to <strong>View</strong> mode to study</li>
              <li>• Click markers to reveal answers</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Overlay when sidebar is open on mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}

