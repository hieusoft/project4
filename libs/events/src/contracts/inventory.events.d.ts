export interface InventoryImportedEvent {
    inventoryItemId: string;
    donationItemId: string;
    groupId: string;
    donorId: string;
}
export interface ItemStatusChangedEvent {
    inventoryItemId: string;
    fromStatus?: string;
    toStatus: string;
    refType?: string;
    refId?: string;
}
