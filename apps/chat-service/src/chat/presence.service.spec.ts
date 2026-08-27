import { PresenceService } from './presence.service.js';

describe('PresenceService', () => {
  it('reports transition to online only on the first connection', () => {
    const presence = new PresenceService();

    expect(presence.markConnected('op-1')).toBe(true);
    expect(presence.markConnected('op-1')).toBe(false);
    expect(presence.getOnlineOperatorIds()).toEqual(['op-1']);
  });

  it('stays online while at least one connection remains (multiple tabs)', () => {
    const presence = new PresenceService();
    presence.markConnected('op-1');
    presence.markConnected('op-1');

    expect(presence.markDisconnected('op-1')).toBe(false);
    expect(presence.getOnlineOperatorIds()).toEqual(['op-1']);
  });

  it('reports transition to offline only when the last connection closes', () => {
    const presence = new PresenceService();
    presence.markConnected('op-1');
    presence.markConnected('op-1');
    presence.markDisconnected('op-1');

    expect(presence.markDisconnected('op-1')).toBe(true);
    expect(presence.getOnlineOperatorIds()).toEqual([]);
  });

  it('tracks multiple operators independently', () => {
    const presence = new PresenceService();
    presence.markConnected('op-1');
    presence.markConnected('op-2');

    expect(presence.getOnlineOperatorIds().sort()).toEqual(['op-1', 'op-2']);

    presence.markDisconnected('op-1');
    expect(presence.getOnlineOperatorIds()).toEqual(['op-2']);
  });
});
