// src/events/event-emitter.ts
/**
 * Event listener type definition
 */
type EventListener = (...args: any[]) => void;

/**
 * Event Emitter class for implementing publish-subscribe pattern
 */
export class EventEmitter {
  /**
   * Internal map of event listeners
   */
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * Add an event listener
   * @param event Event name
   * @param listener Event listener function
   */
  on(event: string, listener: EventListener): void {
    // Create event listener set if not exists
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    // Add listener to the set
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param listener Event listener function
   */
  off(event: string, listener: EventListener): void {
    const eventListeners = this.listeners.get(event);
    
    if (eventListeners) {
      eventListeners.delete(listener);

      // Remove the event entirely if no listeners remain
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event
   * @param event Event name
   * @param args Event arguments
   */
  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);

    if (eventListeners) {
      // Invoke all listeners for the event
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          // Log or handle listener errors
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event
   * @param event Event name
   */
  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Get the number of listeners for an event
   * @param event Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}