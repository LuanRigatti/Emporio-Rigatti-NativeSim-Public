import type { LiveActivityProjection } from './LiveActivityProjection';

export type LiveActivityContent = LiveActivityProjection & {
  isObsolete: boolean;
};

export type LiveActivityOwnership = {
  uid: string;
  activityId: string;
  content: LiveActivityContent;
};

export interface LiveActivityInstance {
  getId(): string;
  update(content: LiveActivityContent, staleDate?: Date): Promise<void>;
  end(dismissalPolicy?: 'default' | 'immediate'): Promise<void>;
}

export interface LiveActivityDriver {
  getInstances(): LiveActivityInstance[];
  start(content: LiveActivityContent, url: string, staleDate?: Date): LiveActivityInstance;
}

export interface LiveActivityOwnershipStore {
  read(): Promise<LiveActivityOwnership | null>;
  write(ownership: LiveActivityOwnership): Promise<void>;
  clear(): Promise<void>;
}
