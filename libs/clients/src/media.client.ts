import { HttpClientBase, ServiceClientOptions } from './http-client.base';
export class MediaClient extends HttpClientBase { constructor(options: ServiceClientOptions) { super(options); } linkMedia(mediaIds: string[], refType: string, refId: string): Promise<unknown> { return this.put('/internal/media/link', { mediaIds, refType, refId }); } }
