import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { IAiProvider } from '../../domain/ports/ai-provider.interface';
import { ItemInfo } from '../../domain/models/item-info.model';
import { ModerationResult } from '../../domain/models/moderation-result.model';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private openai: OpenAI;
  private readonly modelName = process.env.OPENAI_MODEL_NAME || 'gpt-5.5';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || 'mk-live-DdVkkTIa0XAswaSbJTOiEDQcMVlLwU5NOBMYe7ZqPyw';
    this.openai = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || 'https://htmustc.id.vn/v1',
      defaultHeaders: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  }

  private parseJson<T>(text: string): T {
    const match = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error(`AI response does not contain valid JSON format. Raw text: "${text}"`);
    }
    return JSON.parse(match[0]) as T;
  }

  async detectItem(imageUrl: string): Promise<ItemInfo> {
    this.logger.log(`Detecting item from image: ${imageUrl}`);

    const prompt = `Phân tích hình ảnh này và trả về kết quả dưới dạng JSON hợp lệ (không chứa khối mã markdown) với các trường sau:
- name: Tên món đồ (viết bằng tiếng Việt CÓ DẤU ĐẦY ĐỦ, ngắn gọn và chính xác, ví dụ: "Mô hình nhân vật", "Áo sơ mi nam")
- categoryId: Chọn 1 trong các ID sau phù hợp nhất: (clothing, books, electronics, furniture, others)
- condition: Chọn 1 trong các trạng thái sau: (New, Good, Fair, Poor)
- suggestedDescription: Viết một đoạn mô tả chi tiết, tự nhiên và sinh động bằng TIẾNG VIỆT CÓ DẤU ĐẦY ĐỦ (từ 3 đến 5 câu) về kiểu dáng, màu sắc, chi tiết nổi bật và tình trạng món đồ quan sát được trong ảnh.`;

    const modelsToTry = [this.modelName, 'gpt-5.6-sol', 'gpt-4o', 'gpt-4o-mini'];

    const imageCandidates: string[] = [imageUrl];

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        const imageRes = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (imageRes.ok) {
          const arrayBuffer = await imageRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
          imageCandidates.push(`data:${contentType};base64,${buffer.toString('base64')}`);
        }
      } catch (fetchErr: any) {
        this.logger.warn(`Could not fetch image to base64: ${fetchErr.message}`);
      }
    }

    let responseText = '';
    let lastError: any = null;

    for (const targetUrl of imageCandidates) {
      for (const model of modelsToTry) {
        try {
          const response = await this.openai.chat.completions.create({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: targetUrl } },
                ],
              },
            ],
          });
          responseText = response.choices[0]?.message?.content || '';
          if (responseText) break;
        } catch (err: any) {
          lastError = err;
          this.logger.warn(`Model ${model} attempt failed: ${err.message}`);
        }
      }
      if (responseText) break;
    }

    if (!responseText && lastError) {
      throw lastError;
    }

    return this.parseJson<ItemInfo>(responseText);
  }

  async generateDescription(name: string, condition: string): Promise<string> {
    const prompt = `Bạn là một tình nguyện viên thân thiện trên ứng dụng quyên góp từ thiện. 
Hãy viết một đoạn mô tả chi tiết và ấm áp (từ 3 đến 5 câu) bằng TIẾNG VIỆT CÓ DẤU ĐẦY ĐỦ để tặng món đồ sau:
- Tên món đồ: ${name}
- Tình trạng: ${condition}
Mô tả nên thể hiện sự chân thành, động viên những người đang gặp khó khăn mạnh dạn đăng ký nhận đồ. Không thêm tiêu đề.`;

    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('AI failed to generate description');
    }
    return content;
  }

  async moderateContent(content: string, type: 'post' | 'message' | 'listing'): Promise<ModerationResult> {
    const prompt = `Kiểm duyệt nội dung sau (loại: ${type}):
"${content}"

Yêu cầu kiểm tra xem nội dung có vi phạm các lỗi sau không:
1. Từ ngữ phản cảm, chửi bậy, xúc phạm.
2. Lừa đảo, spam, quảng cáo rác.
3. Mua bán thương mại (ứng dụng này chỉ cho tặng từ thiện).

Trả về JSON (không có khối mã markdown) với định dạng:
{
  "isBlocked": true hoặc false,
  "reason": "Lý do ngắn gọn nếu bị block (bằng tiếng Việt có dấu), hoặc rỗng"
}`;

    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.choices[0]?.message?.content || '';
    return this.parseJson<ModerationResult>(responseText);
  }

  async suggestGroups(description: string, province: string, activeGroups: any[]): Promise<any[]> {
    const prompt = `Tôi có một món đồ muốn quyên góp với mô tả: "${description}", ở khu vực: "${province}".
Dưới đây là danh sách các nhóm thiện nguyện đang hoạt động:
${JSON.stringify(activeGroups, null, 2)}

Hãy chọn ra top 3 nhóm phù hợp nhất để nhận món đồ này. 
Trả về mảng JSON (không có khối mã markdown) định dạng:
[
  { "groupId": "id của nhóm", "reason": "Lý do tại sao nhóm này phù hợp (viết bằng tiếng Việt có dấu)" }
]`;

    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.choices[0]?.message?.content || '';
    return this.parseJson<any[]>(responseText);
  }

  async generateImage(prompt: string): Promise<string> {
    this.logger.log(`Generating image for prompt: ${prompt}`);
    const response = await this.openai.images.generate({
      model: 'gpt-image-2',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });
    const url = response.data?.[0]?.url;
    if (!url) {
      throw new Error('AI failed to generate image');
    }
    return url;
  }
}
