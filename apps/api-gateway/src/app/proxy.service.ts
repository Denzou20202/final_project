import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { GatewayConfigService } from './gateway-config.service';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly configService: GatewayConfigService) {}

  async proxyRequest(req: Request, res: Response): Promise<void> {
    const originalUrl = req.originalUrl || req.url;
    const upstreamBase = this.configService.resolveUpstream(originalUrl);

    if (!upstreamBase) {
      throw new NotFoundException(`No upstream service configured for route: ${req.path}`);
    }

    const targetPath = originalUrl.startsWith('/api') ? originalUrl : `/api${originalUrl}`;
    const targetUrl = `${upstreamBase}${targetPath}`;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && typeof value === 'string') {
        headers[key] = value;
      }
    }
    headers['x-forwarded-host'] = req.headers['host'] || 'api-gateway';
    headers['x-forwarded-proto'] = req.protocol || 'http';

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    let body: any = undefined;
    if (hasBody) {
      if (typeof req.body === 'object' && req.body !== null) {
        body = JSON.stringify(req.body);
        headers['content-type'] = headers['content-type'] || 'application/json';
      } else if (req.body) {
        body = req.body;
      }
    }

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
        redirect: 'manual',
      });

      res.status(response.status);
      response.headers.forEach((val, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      this.logger.error(`Upstream request to ${targetUrl} failed: ${err.message}`);
      throw new BadGatewayException({
        statusCode: 502,
        message: 'Upstream service unavailable',
        error: 'Bad Gateway',
        targetUrl,
      });
    }
  }
}
