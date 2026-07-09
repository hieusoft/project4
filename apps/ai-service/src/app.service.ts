import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  private readonly serviceName = 'ai-service';
  getInfo() { return { service: this.serviceName, message: 'ai-service ready' }; }
  getHealth() { return { service: this.serviceName, status: 'ok', uptime: process.uptime() }; }
}
