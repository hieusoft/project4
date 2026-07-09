import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
export interface ServiceClientOptions { baseURL: string; timeoutMs?: number; }
export abstract class HttpClientBase {
  protected readonly http: AxiosInstance;
  protected constructor(options: ServiceClientOptions) { this.http = axios.create({ baseURL: options.baseURL, timeout: options.timeoutMs ?? 5000 }); }
  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> { const response = await this.http.get<T>(url, config); return response.data; }
  protected async post<TResponse, TBody = unknown>(url: string, body: TBody, config?: AxiosRequestConfig): Promise<TResponse> { const response = await this.http.post<TResponse>(url, body, config); return response.data; }
  protected async put<TResponse, TBody = unknown>(url: string, body: TBody, config?: AxiosRequestConfig): Promise<TResponse> { const response = await this.http.put<TResponse>(url, body, config); return response.data; }
}
