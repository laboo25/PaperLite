import { PDFAnnotation } from '../types';

export type HistoryActionType = 
  | 'add_annotation'
  | 'delete_annotation'
  | 'edit_annotation'
  | 'clear_page';

export interface HistoryAction {
  id: string;
  type: HistoryActionType;
  description: string;
  timestamp: number;
  annotation?: PDFAnnotation;
  previousAnnotation?: PDFAnnotation;
  pageNumber?: number;
  previousList?: PDFAnnotation[];
  updatedList?: PDFAnnotation[];
}

export class HistoryTracker {
  private undoStacks: Map<string, HistoryAction[]> = new Map();
  private redoStacks: Map<string, HistoryAction[]> = new Map();
  private maxStackSize: number = 50;

  private getUndoStack(fingerprint: string): HistoryAction[] {
    if (!this.undoStacks.has(fingerprint)) {
      this.undoStacks.set(fingerprint, []);
    }
    return this.undoStacks.get(fingerprint)!;
  }

  private getRedoStack(fingerprint: string): HistoryAction[] {
    if (!this.redoStacks.has(fingerprint)) {
      this.redoStacks.set(fingerprint, []);
    }
    return this.redoStacks.get(fingerprint)!;
  }

  /**
   * Pushes a new action onto the undo stack and clears the redo stack
   */
  pushAction(fingerprint: string, action: Omit<HistoryAction, 'id' | 'timestamp'>): HistoryAction {
    const undoStack = this.getUndoStack(fingerprint);
    const redoStack = this.getRedoStack(fingerprint);

    const fullAction: HistoryAction = {
      ...action,
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now()
    };

    undoStack.push(fullAction);
    if (undoStack.length > this.maxStackSize) {
      undoStack.shift();
    }

    // Clear redo stack on new action
    redoStack.length = 0;

    return fullAction;
  }

  canUndo(fingerprint: string): boolean {
    return this.getUndoStack(fingerprint).length > 0;
  }

  canRedo(fingerprint: string): boolean {
    return this.getRedoStack(fingerprint).length > 0;
  }

  getUndoDescription(fingerprint: string): string | null {
    const stack = this.getUndoStack(fingerprint);
    if (stack.length === 0) return null;
    return stack[stack.length - 1].description;
  }

  getRedoDescription(fingerprint: string): string | null {
    const stack = this.getRedoStack(fingerprint);
    if (stack.length === 0) return null;
    return stack[stack.length - 1].description;
  }

  getHistoryStack(fingerprint: string): HistoryAction[] {
    return [...this.getUndoStack(fingerprint)];
  }

  /**
   * Performs an Undo and returns the inverse action details
   */
  undo(fingerprint: string): HistoryAction | null {
    const undoStack = this.getUndoStack(fingerprint);
    const redoStack = this.getRedoStack(fingerprint);

    if (undoStack.length === 0) return null;

    const action = undoStack.pop()!;
    redoStack.push(action);
    return action;
  }

  /**
   * Performs a Redo and returns the action details to re-apply
   */
  redo(fingerprint: string): HistoryAction | null {
    const undoStack = this.getUndoStack(fingerprint);
    const redoStack = this.getRedoStack(fingerprint);

    if (redoStack.length === 0) return null;

    const action = redoStack.pop()!;
    undoStack.push(action);
    return action;
  }

  /**
   * Clears history for a specific document or all documents
   */
  clear(fingerprint?: string): void {
    if (fingerprint) {
      this.undoStacks.delete(fingerprint);
      this.redoStacks.delete(fingerprint);
    } else {
      this.undoStacks.clear();
      this.redoStacks.clear();
    }
  }
}

export const historyTracker = new HistoryTracker();
