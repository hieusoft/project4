import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  private readonly serviceName = 'community-service';
  getInfo() { return { service: this.serviceName, message: 'community-service ready' }; }
  getHealth() { return { service: this.serviceName, status: 'ok', uptime: process.uptime() }; }
}
