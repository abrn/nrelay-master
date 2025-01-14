import { NewTickPacket, ObjectData, UpdatePacket } from '@realmlib/net';
import { EventEmitter } from 'events';
import { Client, Library, PacketHook } from '../core';

/**
 * An event listener for events emitted by the `ObjectTracker`.
 */
export type ObjectEventListener = (obj: ObjectData, client: Client) => void;

@Library({
  name: 'object tracker library'
})
export class ObjectTracker {
  private emitter: EventEmitter;
  private readonly trackedTypes: Set<number>;
  private readonly trackedObjects: {
    [guid: string]: ObjectData[];
  };

  constructor() {
    this.emitter = new EventEmitter();
    this.trackedTypes = new Set();
    this.trackedObjects = {};
  }

  /**
   * Attaches an event listener to the specified event.
   * @param event The event to attach the listener to.
   * @param listener The function to invoke when the event is fired.
   */
  on(event: number | 'any', listener: ObjectEventListener): this {
    this.emitter.on(event.toString(), listener);
    return this;
  }

  /**
   * Starts tracking the specified object,
   * and optionally attaches an event listener.
   * @param objectType The object type to start track.
   * @param listener An optional event listener to attach.
   */
  startTracking(objectType: number, listener?: ObjectEventListener): this {
    this.trackedTypes.add(objectType);
    if (listener) {
      this.on(objectType, listener);
    }
    return this;
  }

  /**
   * Stops tracking the specified object and
   * removes any event listeners for it.
   * @param objectType The object type to stop tracking.
   */
  stopTracking(objectType: number): this {
    if (!this.trackedTypes.hasOwnProperty(objectType)) {
      return;
    }
    this.trackedTypes.delete(objectType);
    this.emitter.removeAllListeners(objectType.toString());
  }

  @PacketHook()
  private onUpdate(client: Client, update: UpdatePacket): void {
    for (const obj of update.newObjects) {
      if (this.trackedTypes.has(obj.objectType)) {
        if (!this.trackedObjects.hasOwnProperty(client.guid)) {
          this.trackedObjects[client.guid] = [];
        }
        this.trackedObjects[client.guid].push(obj);
        this.emitter.emit(obj.objectType.toString(), obj, client);
        this.emitter.emit('any', obj, client);
      }
    }

    if (!this.trackedObjects.hasOwnProperty(client.guid)) {
      return;
    }
    for (const drop of update.drops) {
      for (let n = 0; n < this.trackedObjects[client.guid].length; n++) {
        if (this.trackedObjects[client.guid][n].status.objectId === drop) {
          this.trackedObjects[client.guid].splice(n, 1);
          break;
        }
      }
    }
  }

  @PacketHook()
  private onNewTick(client: Client, newTick: NewTickPacket): void {
    if (!this.trackedObjects.hasOwnProperty(client.guid) || this.trackedObjects[client.guid].length < 1) {
      return;
    }
    for (const status of newTick.statuses) {
      for (const obj of this.trackedObjects[client.guid]) {
        if (obj.status.objectId === status.objectId) {
          obj.status = status;
          break;
        }
      }
    }
  }
}
