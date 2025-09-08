// /lib/history.js
// Gestor de historial (undo/redo) sin dependencias, con límite de memoria y autosave opcional.
export default class HistoryManager {
  constructor({ limit = 100, onChange } = {}) {
    this.stack = [];
    this.index = -1;
    this.limit = limit;
    this.onChange = typeof onChange === 'function' ? onChange : null;
  }

  _notify() {
    if (this.onChange) this.onChange(this.getState());
  }

  clear() {
    this.stack = [];
    this.index = -1;
    this._notify();
  }

  /**
   * push(state): Inserta un "snapshot" serializable del diseño.
   * IMPORTANTE: Pasa siempre un objeto NUEVO (clonado) de tu estado de diseño.
   */
  push(state) {
    if (state == null) return;
    // Si hiciste undo y ahora empujas, descarta el futuro
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }
    this.stack.push(state);
    // Limitar tamaño
    if (this.stack.length > this.limit) {
      this.stack.shift();
    } else {
      this.index++;
    }
    this._notify();
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }

  undo() {
    if (!this.canUndo()) return this.getState();
    this.index--;
    this._notify();
    return this.getState();
  }

  redo() {
    if (!this.canRedo()) return this.getState();
    this.index++;
    this._notify();
    return this.getState();
  }

  getState() {
    if (this.index < 0 || this.index >= this.stack.length) return null;
    return this.stack[this.index];
  }

  size() { return this.stack.length; }
  position() { return this.index; }
}
