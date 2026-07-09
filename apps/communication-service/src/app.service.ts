import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  private readonly serviceName = 'communication-service';
  getInfo() { return { service: this.serviceName, message: 'communication-service ready' }; }
  getHealth() { return { service: this.serviceName, status: 'ok', uptime: process.uptime() }; }
}
