import type { LiveActivityProjection } from './LiveActivityProjection';

export type LiveActivityContent = LiveActivityProjection & {
  isObsolete: boolean;
  /** Opaque widget authorization session; never contains the account UID. */
  actionSessionId?: string;
  actionRevision?: number;
};

export type LiveActivityOwnership = {
  uid: string;
  activityId: string;
  content: LiveActivityContent;
  /** Local-only IDs used to distinguish new pending deliveries after system dismissal. */
  deliveryIds?: string[];
};

export interface LiveActivityInstance {
  getId(): string;
  update(content: LiveActivityContent, staleDate?: Date): Promise<void>;
  end(
    dismissalPolicy?: 'default' | 'immediate',
    content?: LiveActivityContent,
    contentDate?: Date,
  ): Promise<void>;
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
