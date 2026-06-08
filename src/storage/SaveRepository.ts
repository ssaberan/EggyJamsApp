import type { SaveSlotData, SaveSlotMeta } from './types';

export interface SaveRepository {
  listSlots(projectId: string): Promise<SaveSlotMeta[]>;
  upsertSlot(
    projectId: string,
    slotIndex: number,
    data: SaveSlotData,
  ): Promise<void>;
  deleteSlot(projectId: string, slotIndex: number): Promise<void>;
}
