import { HttpClientBase, ServiceClientOptions } from './http-client.base';
export class MarketplaceClient extends HttpClientBase { constructor(options: ServiceClientOptions) { super(options); } getListing(listingId: string): Promise<unknown> { return this.get(`/internal/listings/${listingId}`); } }
