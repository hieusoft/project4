import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import { IAiProvider } from '../../domain/ports/ai-provider.interface';
import { ItemInfo } from '../../domain/models/item-info.model';
import { ModerationResult } from '../../domain/models/moderation-result.model';

@Injectable()
export class GeminiProvider implements IAiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private visionModel: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || 'dummy_key_for_now';
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  generateImage(prompt: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async detectItem(imageUrl: string): Promise<ItemInfo> {
    try {
      this.logger.log(`Detecting item from image: ${imageUrl}`);
      
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      
      const imagePart: Part = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      };

      const prompt = `Phân tích hình ảnh này và trả về kết quả dưới dạng JSON hợp lệ (không chứa blockcode markdown) với các trường sau:
- name: Tên món đồ (ngắn gọn)
- categoryId: Chọn 1 trong các ID sau (clothing, books, electronics, furniture, others)
- condition: Chọn 1 trong các trạng thái sau (New, Good, Fair, Poor)
- suggestedDescription: Mô tả ngắn gọn về tình trạng món đồ thấy được trong ảnh.`;

      const result = await this.visionModel.generateContent([prompt, imagePart]);
      const responseText = result.response.text();
      
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr) as ItemInfo;
    } catch (error: any) {
      this.logger.error(`Error detecting item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateDescription(name: string, condition: string): Promise<string> {
    try {
      const prompt = `Bạn là một người tình nguyện viên trên ứng dụng quyên góp từ thiện. 
Hãy viết 1 đoạn mô tả (khoảng 3-4 câu) thật ấm áp, lịch sự và chân thành để tặng món đồ sau:
- Tên món đồ: ${name}
- Tình trạng: ${condition}
Mô tả nên khuyến khích những người đang gặp khó khăn mạnh dạn đăng ký nhận đồ. Không cần thêm tiêu đề.`;

      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error: any) {
      this.logger.error(`Error generating description: ${error.message}`, error.stack);
      throw error;
    }
  }

  async moderateContent(content: string, type: 'post' | 'message' | 'listing'): Promise<ModerationResult> {
    try {
      const prompt = `Kiểm duyệt nội dung sau (loại: ${type}):
"${content}"

Yêu cầu kiểm tra xem nội dung có vi phạm các lỗi sau không:
1. Từ ngữ phản cảm, chửi bậy, xúc phạm.
2. Lừa đảo, spam, quảng cáo rác.
3. Mua bán thương mại (ứng dụng này chỉ cho tặng từ thiện).

Trả về JSON (không có blockcode markdown) với định dạng:
{
  "isBlocked": true hoặc false,
  "reason": "Lý do ngắn gọn nếu bị block, hoặc rỗng"
}`;

      const result = await this.model.generateContent(prompt);
      const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr) as ModerationResult;
    } catch (error: any) {
      this.logger.error(`Error moderating content: ${error.message}`, error.stack);
      return { isBlocked: false };
    }
  }

  async suggestGroups(description: string, province: string, activeGroups: any[]): Promise<any[]> {
    try {
      const prompt = `Tôi có một món đồ muốn quyên góp với mô tả: "${description}", ở khu vực: "${province}".
Dưới đây là danh sách các nhóm thiện nguyện đang hoạt động:
${JSON.stringify(activeGroups, null, 2)}

Hãy chọn ra top 3 nhóm phù hợp nhất để nhận món đồ này. 
Trả về mảng JSON (không có blockcode markdown) định dạng:
[
  { "groupId": "id của nhóm", "reason": "Lý do tại sao nhóm này phù hợp (1 câu)" }
]`;

      const result = await this.model.generateContent(prompt);
      const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error: any) {
      this.logger.error(`Error suggesting groups: ${error.message}`, error.stack);
      return [];
    }
  }
}
