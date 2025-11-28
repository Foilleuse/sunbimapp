import { useState, useCallback } from 'react';

export interface DrawingPath {
  svgPath: string;
  color: string;
  width: number;
  isEraser?: boolean;
}

export const useDrawing = () => {
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingPath[]>([]);

  // Ajouter un trait
  const addPath = useCallback((path: DrawingPath) => {
    setPaths((current) => [...current, path]);
    setRedoStack([]); // On vide le redo quand on dessine
  }, []);

  // Annuler
  const undo = useCallback(() => {
    setPaths((current) => {
      if (current.length === 0) return current;
      const newPaths = [...current];
      const removed = newPaths.pop();
      if (removed) setRedoStack((stack) => [...stack, removed]);
      return newPaths;
    });
  }, []);

  // Rétablir
  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const newStack = [...stack];
      const restored = newStack.pop();
      if (restored) setPaths((current) => [...current, restored]);
      return newStack;
    });
  }, []);

  // Tout effacer
  const clear = useCallback(() => {
    setPaths([]);
    setRedoStack([]);
  }, []);

  return { paths, addPath, undo, redo, clear };
};