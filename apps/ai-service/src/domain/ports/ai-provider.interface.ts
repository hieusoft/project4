import { ItemInfo } from '../models/item-info.model';
import { ModerationResult } from '../models/moderation-result.model';

export const AI_PROVIDER = 'IAiProvider';

export interface IAiProvider {
  detectItem(imageUrl: string): Promise<ItemInfo>;
  generateDescription(name: string, condition: string): Promise<string>;
  moderateContent(content: string, type: 'post' | 'message' | 'listing'): Promise<ModerationResult>;
  suggestGroups(description: string, province: string, activeGroups: any[]): Promise<any[]>;
  generateImage(prompt: string): Promise<string>;
}
