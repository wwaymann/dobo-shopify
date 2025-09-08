// lib/history.js
export default class HistoryManager {
  constructor({ limit = 200, onChange } = {}) {
    this.stack = []; this.index = -1; this.limit = limit; this.onChange = onChange;
  }
  push(state) {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(state);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
    this.onChange?.(this.stack[this.index]);
  }
  undo() {
    if (!this.canUndo()) return null;
    this.index -= 1; const s = this.stack[this.index];
    this.onChange?.(s); return s;
  }
  redo() {
    if (!this.canRedo()) return null;
    this.index += 1; const s = this.stack[this.index];
    this.onChange?.(s); return s;
  }
  canUndo() { return this.index > 0; }
  canRedo() { return this.index >= 0 && this.index < this.stack.length - 1; }
}
