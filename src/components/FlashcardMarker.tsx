'use client';

import React, { useState } from 'react';
import { Flashcard, AppMode } from '@/types';

interface FlashcardMarkerProps {
  flashcard: Flashcard;
  mode: AppMode;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

export function FlashcardMarker({ flashcard, mode, isSelected, onSelect, onDelete }: FlashcardMarkerProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === 'view') {
      setIsFlipped(!isFlipped);
    } else {
      onSelect();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const cardColor = flashcard.color || '#3b82f6';

  return (
    <div className="relative">
      {/* Floating Square Card */}
      <div
        onClick={handleClick}
        className={`
          relative w-48 min-h-24 p-3 rounded-xl cursor-pointer
          transition-all duration-300 ease-out
          ${isSelected ? 'ring-4 ring-yellow-400 scale-110' : 'hover:scale-105'}
          ${isFlipped ? 'shadow-xl' : 'shadow-lg hover:shadow-xl'}
        `}
        style={{
          backgroundColor: isFlipped ? '#f0fdf4' : 'white',
          borderLeft: `4px solid ${cardColor}`,
        }}
      >
        {/* Card Header */}
        <div
          className="flex items-center gap-2 mb-2 pb-2 border-b"
          style={{ borderColor: `${cardColor}40` }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: cardColor }}
          >
            {isFlipped ? '✓' : '?'}
          </div>
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: cardColor }}
          >
            {isFlipped ? 'Answer' : 'Question'}
          </span>

          {/* Edit mode delete button */}
          {mode === 'edit' && (
            <button
              onClick={handleDelete}
              className="ml-auto w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs transition-colors"
              title="Delete card"
            >
              ✕
            </button>
          )}
        </div>

        {/* Card Content */}
        <div className="text-sm text-gray-800 leading-relaxed">
          {isFlipped ? (
            <div className="text-green-800">{flashcard.answer}</div>
          ) : (
            <div>{flashcard.question}</div>
          )}
        </div>

        {/* Footer hint */}
        {mode === 'view' && (
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 text-center">
            {isFlipped ? 'Click to see question' : 'Click to reveal answer'}
          </div>
        )}

        {/* Decorative corner */}
        <div
          className="absolute top-0 right-0 w-0 h-0"
          style={{
            borderTop: `16px solid ${cardColor}`,
            borderLeft: '16px solid transparent',
            borderTopRightRadius: '12px',
          }}
        />

        {/* Floating animation pulse */}
        {!isFlipped && mode === 'view' && (
          <div
            className="absolute -inset-1 rounded-xl animate-pulse opacity-20 -z-10"
            style={{ backgroundColor: cardColor }}
          />
        )}
      </div>

      {/* Connection line to position (small dot indicator) */}
      <div
        className="absolute left-1/2 top-full w-px h-4 -translate-x-1/2"
        style={{ backgroundColor: cardColor }}
      />
      <div
        className="absolute left-1/2 top-full mt-4 w-3 h-3 rounded-full -translate-x-1/2 animate-bounce"
        style={{ backgroundColor: cardColor }}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="absolute top-0 left-full ml-2 bg-white rounded-lg shadow-xl p-3 z-50 w-48">
          <p className="text-sm text-gray-800 mb-3">Delete this flashcard?</p>
          <div className="flex gap-2">
            <button
              onClick={confirmDelete}
              className="flex-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={cancelDelete}
              className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

