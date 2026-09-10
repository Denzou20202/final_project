import { TicketViewersService } from './ticket-viewers.service.js';

describe('TicketViewersService', () => {
  it('lists a viewer after joining', () => {
    const viewers = new TicketViewersService();
    viewers.join('ticket-1', 'socket-a', 'op-1');

    expect(viewers.getViewerIds('ticket-1')).toEqual(['op-1']);
  });

  it('a duplicate join from the SAME socket does not require two leaves — the exact race that caused the stuck-viewer bug', () => {
    const viewers = new TicketViewersService();
    // Mirrors the client's double ticket:join: once buffered before the
    // socket connects, once again from its own 'connect' handler.
    viewers.join('ticket-1', 'socket-a', 'op-1');
    viewers.join('ticket-1', 'socket-a', 'op-1');

    viewers.leave('ticket-1', 'socket-a');

    expect(viewers.getViewerIds('ticket-1')).toEqual([]);
  });

  it('two different sockets for the same user (two tabs) both count, and closing one leaves the other', () => {
    const viewers = new TicketViewersService();
    viewers.join('ticket-1', 'socket-a', 'op-1');
    viewers.join('ticket-1', 'socket-b', 'op-1');

    viewers.leave('ticket-1', 'socket-a');
    expect(viewers.getViewerIds('ticket-1')).toEqual(['op-1']);

    viewers.leave('ticket-1', 'socket-b');
    expect(viewers.getViewerIds('ticket-1')).toEqual([]);
  });

  it('tracks distinct users viewing the same ticket, deduped', () => {
    const viewers = new TicketViewersService();
    viewers.join('ticket-1', 'socket-a', 'op-1');
    viewers.join('ticket-1', 'socket-b', 'op-2');

    expect(viewers.getViewerIds('ticket-1').sort()).toEqual(['op-1', 'op-2']);
  });

  it('leaving a socket that never joined is a harmless no-op', () => {
    const viewers = new TicketViewersService();

    expect(() => viewers.leave('ticket-1', 'socket-a')).not.toThrow();
    expect(viewers.getViewerIds('ticket-1')).toEqual([]);
  });
});
