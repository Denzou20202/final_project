import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GatewayConfigService } from './gateway-config.service';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let configService: GatewayConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProxyService, GatewayConfigService],
    }).compile();

    service = module.get<ProxyService>(ProxyService);
    configService = module.get<GatewayConfigService>(GatewayConfigService);
  });

  describe('resolveUpstream', () => {
    it('resolves user service routes correctly', () => {
      expect(configService.resolveUpstream('/api/auth/login')).toBe(configService.userServiceUrl);
      expect(configService.resolveUpstream('/api/users/me')).toBe(configService.userServiceUrl);
      expect(configService.resolveUpstream('/api/companies')).toBe(configService.userServiceUrl);
      expect(configService.resolveUpstream('/api/cities')).toBe(configService.userServiceUrl);
      expect(configService.resolveUpstream('/api/permission-groups')).toBe(configService.userServiceUrl);
    });

    it('resolves ticket service routes correctly', () => {
      expect(configService.resolveUpstream('/api/tickets')).toBe(configService.ticketServiceUrl);
      expect(configService.resolveUpstream('/api/ticket-statuses')).toBe(configService.ticketServiceUrl);
      expect(configService.resolveUpstream('/api/attachments/123')).toBe(configService.ticketServiceUrl);
    });

    it('resolves chat service routes correctly', () => {
      expect(configService.resolveUpstream('/api/chats/123/messages')).toBe(configService.chatServiceUrl);
    });

    it('resolves knowledge service routes correctly', () => {
      expect(configService.resolveUpstream('/api/articles')).toBe(configService.knowledgeServiceUrl);
    });

    it('resolves analytics service routes correctly', () => {
      expect(configService.resolveUpstream('/api/reports')).toBe(configService.analyticsServiceUrl);
      expect(configService.resolveUpstream('/api/analytics/summary')).toBe(configService.analyticsServiceUrl);
    });

    it('returns null for unknown routes', () => {
      expect(configService.resolveUpstream('/api/unknown-service/test')).toBeNull();
    });
  });

  describe('proxyRequest', () => {
    it('throws NotFoundException for unrecognized routes', async () => {
      const mockReq: any = {
        originalUrl: '/api/unrecognized',
        path: '/api/unrecognized',
        method: 'GET',
        headers: {},
      };
      const mockRes: any = {};

      await expect(service.proxyRequest(mockReq, mockRes)).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException when upstream fetch fails', async () => {
      const mockReq: any = {
        originalUrl: '/api/users/me',
        path: '/api/users/me',
        method: 'GET',
        headers: {},
      };
      const mockRes: any = {};

      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.proxyRequest(mockReq, mockRes)).rejects.toThrow(BadGatewayException);
    });

    it('forwards response status, headers, and body when upstream succeeds', async () => {
      const mockReq: any = {
        originalUrl: '/api/tickets',
        path: '/api/tickets',
        method: 'GET',
        headers: { authorization: 'Bearer token' },
      };

      const setHeader = jest.fn();
      const status = jest.fn();
      const send = jest.fn();
      const mockRes: any = { setHeader, status, send };

      const mockResponseHeaders = new Map([
        ['content-type', 'application/json'],
        ['connection', 'close'], // hop-by-hop, should be stripped
      ]);

      const mockFetchResponse: any = {
        status: 200,
        headers: {
          forEach: (cb: (val: string, key: string) => void) => mockResponseHeaders.forEach(cb),
        },
        arrayBuffer: async () => Buffer.from('{"data":[]}'),
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse);

      await service.proxyRequest(mockReq, mockRes);

      expect(status).toHaveBeenCalledWith(200);
      expect(setHeader).toHaveBeenCalledWith('content-type', 'application/json');
      expect(setHeader).not.toHaveBeenCalledWith('connection', expect.anything());
      expect(send).toHaveBeenCalledWith(Buffer.from('{"data":[]}'));
    });
  });
});
