import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { IAiProvider } from '../../domain/ports/ai-provider.interface';
import { ItemInfo } from '../../domain/models/item-info.model';
import { ModerationResult } from '../../domain/models/moderation-result.model';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private openai: OpenAI;
  private readonly modelName = 'grok-4.5'; // Model theo yeu cau cua ban

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || 'mk-live-xxxxxxxxxxxxxxxxxxxx';
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://htmustc.id.vn/v1',
    });
  }

  async detectItem(imageUrl: string): Promise<ItemInfo> {
    try {
      this.logger.log(`Detecting item from image: ${imageUrl}`);
      
      const prompt = `Phan tich hinh anh nay va tra ve ket qua duoi dang JSON hop le (khong chua blockcode markdown) voi cac truong sau:
- name: Ten mon do (ngan gon)
- categoryId: Chon 1 trong cac ID sau (clothing, books, electronics, furniture, others)
- condition: Chon 1 trong cac trang thai sau (New, Good, Fair, Poor)
- suggestedDescription: Mo ta ngan gon ve tinh trang mon do thay duoc trong anh.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5.6-sol',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      });

      const responseText = response.choices[0].message.content || '{}';
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr) as ItemInfo;
    } catch (error: any) {
      this.logger.error(`Error detecting item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateDescription(name: string, condition: string): Promise<string> {
    try {
      const prompt = `Ban la mot nguoi tinh nguyen vien tren ung dung quyen gop tu thien. 
Hay viet 1 doan mo ta (khoang 3-4 cau) that am ap, lich su va chan thanh de tang mon do sau:
- Ten mon do: ${name}
- Tinh trang: ${condition}
Mo ta nen khuyen khich nhung nguoi dang gap kho khan manh dan dang ky nhan do. Khong can them tieu de.`;

      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.choices[0].message.content?.trim() || '';
    } catch (error: any) {
      this.logger.error(`Error generating description: ${error.message}`, error.stack);
      throw error;
    }
  }

  async moderateContent(content: string, type: 'post' | 'message' | 'listing'): Promise<ModerationResult> {
    try {
      const prompt = `Kiem duyet noi dung sau (loai: ${type}):
"${content}"

Yeu cau kiem tra xem noi dung co vi pham cac loi sau khong:
1. Tu ngu phan cam, chui bay, xuc pham.
2. Lua dao, spam, quang cao rac.
3. Mua ban thuong mai (ung dung nay chi cho tang tu thien).

Tra ve JSON (khong co blockcode markdown) voi dinh dang:
{
  "isBlocked": true hoac false,
  "reason": "Ly do ngan gon neu bi block, hoac rong"
}`;

      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
      });

      const jsonStr = response.choices[0].message.content?.replace(/```json/g, '')?.replace(/```/g, '')?.trim() || '{}';
      return JSON.parse(jsonStr) as ModerationResult;
    } catch (error: any) {
      this.logger.error(`Error moderating content: ${error.message}`, error.stack);
      return { isBlocked: false };
    }
  }

  async suggestGroups(description: string, province: string, activeGroups: any[]): Promise<any[]> {
    try {
      const prompt = `Toi co mot mon do muon quyen gop voi mo ta: "${description}", o khu vuc: "${province}".
Duoi day la danh sach cac nhom thien nguyen dang hoat dong:
${JSON.stringify(activeGroups, null, 2)}

Hay chon ra top 3 nhom phu hop nhat de nhan mon do nay. 
Tra ve mang JSON (khong co blockcode markdown) dinh dang:
[
  { "groupId": "id cua nhom", "reason": "Ly do tai sao nhom nay phu hop (1 cau)" }
]`;

      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
      });

      const jsonStr = response.choices[0].message.content?.replace(/```json/g, '')?.replace(/```/g, '')?.trim() || '[]';
      return JSON.parse(jsonStr);
    } catch (error: any) {
      this.logger.error(`Error suggesting groups: ${error.message}`, error.stack);
      return [];
    }
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      this.logger.log(`Generating image for prompt: ${prompt}`);
      const response = await this.openai.images.generate({
        model: 'gpt-image-2',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard', // or high as per request
      });
      return response.data?.[0]?.url || '';
    } catch (error: any) {
      this.logger.error(`Error generating image: ${error.message}`, error.stack);
      throw error;
    }
  }
}
