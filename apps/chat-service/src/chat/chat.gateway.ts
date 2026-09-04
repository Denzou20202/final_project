import { staffCanSeeTicket, type JwtPayload } from '@veloxdesk/common';
import type { TicketEntity, TicketStatusEntity } from '@veloxdesk/database';
import { PublicTicketStatus, TicketEventPayload, UserRole } from '@veloxdesk/types';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service.js';
import type { PublicComment } from './comment.public.js';
import { EditMessageDto } from './dto/edit-message.dto.js';
import { JoinTicketDto } from './dto/join-ticket.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { SetStatusDto } from './dto/set-status.dto.js';
import { EmployeeStatusService } from './employee-status.service.js';
import { PresenceService } from './presence.service.js';
import { TicketViewersService } from './ticket-viewers.service.js';
import { WsAuthService } from './ws-auth.service.js';
import { WsLoggingExceptionFilter } from './ws-logging-exception.filter.js';

const OPERATORS_ROOM = 'operators';
// Admin-only subset of OPERATORS_ROOM — an admin joins both. Only used for
// self-registration approval events today (see UserEventsSubscriberService);
// broadcastToOperators/OPERATORS_ROOM stays the room for anything staff-wide.
const ADMINS_ROOM = 'admins';

// Own small copy of ticket-service's ticket-status.public.ts mapper — chat-
// service is a separate app with no access to that one, and this is too
// small to be worth a shared lib (same "each app keeps its own copies"
// convention already used for the frontend's status labels).
function toPublicTicketStatus(status: TicketStatusEntity): PublicTicketStatus {
  return {
    id: status.id,
    key: status.key ?? null,
    name: status.name,
    nameUk: status.nameUk ?? null,
    nameEn: status.nameEn ?? null,
    color: status.color,
    isDefault: status.isDefault,
    isClosed: status.isClosed,
    tracksSla: status.tracksSla,
    sortOrder: status.sortOrder,
  };
}

function ticketRoom(ticketId: string): string {
  return `ticket:${ticketId}`;
}

// Lets a reply reach a specific client directly (e.g. for a browser
// notification/sound) even when they aren't currently looking at that one
// ticket's page — mirrors OPERATORS_ROOM, which does the same for staff.
function userRoom(userId: string): string {
  return `user:${userId}`;
}

// @WebSocketGateway's options are evaluated at class-decoration time (module
// load), before Nest's DI container exists — so this reads process.env
// directly rather than going through ConfigService, same CORS_ORIGINS
// convention as every other service's main.ts.
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:4201')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@UseFilters(WsLoggingExceptionFilter)
@WebSocketGateway({
  cors: { origin: allowedOrigins, credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly chatService: ChatService,
    private readonly presence: PresenceService,
    private readonly ticketViewers: TicketViewersService,
    private readonly employeeStatus: EmployeeStatusService,
  ) {}

  // Runs as Socket.IO NAMESPACE MIDDLEWARE — before the 'connection' event,
  // and therefore before ANY @SubscribeMessage handler can possibly fire on
  // this socket. This used to happen inside handleConnection below instead
  // (an async handler that runs AFTER 'connection' already fired), which left
  // a real race: a client emits its very first message (e.g. ticket:join)
  // the instant the transport connects, and socket.io dispatches inbound
  // messages independently of how long handleConnection's own await chain
  // takes — so that first message could reach requireUser() before
  // client.data.user was ever set, which force-disconnected the socket via
  // client.disconnect(true). A server-initiated disconnect does NOT
  // auto-reconnect client-side (only network-blip/client-initiated ones do),
  // so the tab was left with a permanently dead realtime connection — no
  // chat history, no live updates of any kind — until a hard page reload
  // created a fresh socket. Authenticating in middleware closes that window
  // entirely: 'connection' (and therefore every handler below) is now
  // guaranteed to fire only after client.data.user is already set.
  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.wsAuth
        .authenticate(socket)
        .then((user) => {
          if (!user) {
            next(new Error('Unauthorized'));
            return;
          }
          socket.data.user = user;
          next();
        })
        .catch((err) => next(err instanceof Error ? err : new Error('Unauthorized')));
    });
  }

  // Shared shape for the initial snapshot and every subsequent broadcast —
  // statuses only ever includes online operators with a non-default (i.e.
  // not plain «Онлайн») live status; see EmployeeStatusService.getSnapshot.
  private presencePayload() {
    const onlineOperatorIds = this.presence.getOnlineOperatorIds();
    return { onlineOperatorIds, statuses: this.employeeStatus.getSnapshot(onlineOperatorIds) };
  }

  async handleConnection(client: Socket): Promise<void> {
    // Guaranteed set by the afterInit middleware above — 'connection' (which
    // triggers this hook) can't fire until that middleware's next() runs.
    const user = client.data.user as JwtPayload;

    // Every socket joins its own userRoom regardless of role — staff also
    // needs this for targeted per-user pushes (e.g. an @mention notification)
    // that shouldn't broadcast to OPERATORS_ROOM at large.
    await client.join(userRoom(user.sub));

    let justWentOnline = false;
    if (user.role !== UserRole.CLIENT) {
      await client.join(OPERATORS_ROOM);
      justWentOnline = this.presence.markConnected(user.sub);
      if (justWentOnline) {
        await this.employeeStatus.onOperatorConnect(user.sub);
        // A disconnect that lands during the DB round trip above already ran
        // handleDisconnect — which found nothing yet to clean up in
        // liveByOperator — before onOperatorConnect's own entry gets written
        // here after the fact. Left alone that entry never gets removed
        // (nothing will call onOperatorDisconnect for this socket again):
        // self-correct by re-running it now that the write has landed.
        if (client.disconnected) {
          this.employeeStatus.onOperatorDisconnect(user.sub);
          return;
        }
      }
    }
    if (user.role === UserRole.ADMIN) {
      await client.join(ADMINS_ROOM);
    }

    // Every connected client (client-role sockets included) gets the current
    // operator presence snapshot immediately, so a chat UI can show "an
    // operator is available" without waiting for the next presence change.
    // Sent after onOperatorConnect above so a freshly-connecting operator's
    // own status is already reflected in the snapshot they receive.
    client.emit('presence:operators', this.presencePayload());
    if (justWentOnline) {
      this.server.emit('presence:operators', this.presencePayload());
    }
    this.logger.debug(`Client connected: ${user.sub} (${user.role})`);
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) {
      return;
    }
    if (user.role !== UserRole.CLIENT && this.presence.markDisconnected(user.sub)) {
      this.employeeStatus.onOperatorDisconnect(user.sub);
      this.server.emit('presence:operators', this.presencePayload());
    }

    // A closed tab never gets to emit 'ticket:leave' — this is the only
    // place that catches it, tracked per-socket since one connection views
    // at most one ticket detail page at a time.
    const currentTicketId = client.data.currentTicketId as string | undefined;
    if (currentTicketId) {
      this.ticketViewers.leave(currentTicketId, client.id);
      this.server.to(ticketRoom(currentTicketId)).emit('ticket:viewers', {
        ticketId: currentTicketId,
        viewerIds: this.ticketViewers.getViewerIds(currentTicketId),
      });
    }

    this.logger.debug(`Client disconnected: ${user.sub}`);
  }

  @SubscribeMessage('ticket:join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() dto: JoinTicketDto): Promise<void> {
    const user = this.requireUser(client);

    // Read-then-write client.data.currentTicketId synchronously, before any
    // await — fast row-to-row navigation can fire a second ticket:join for
    // this same socket before the first call's own awaits below resolve.
    // With the read/write split across those awaits (as it used to be),
    // the second call could read a stale previousTicketId (or, worse, a
    // value the first call hadn't written yet, or had already overwritten),
    // producing an incorrect "leave" or skipping it — a phantom viewer
    // entry not even a later disconnect cleans up (handleDisconnect only
    // touches whatever currentTicketId happens to hold at that moment).
    // Worst case if getTicketForParticipant below rejects this join:
    // currentTicketId points at a ticket ticketViewers never actually
    // registered the socket for, which the next real join's own leave
    // harmlessly no-ops on and self-corrects.
    const previousTicketId = client.data.currentTicketId as string | undefined;
    client.data.currentTicketId = dto.ticketId;
    if (previousTicketId && previousTicketId !== dto.ticketId) {
      this.ticketViewers.leave(previousTicketId, client.id);
      this.server.to(ticketRoom(previousTicketId)).emit('ticket:viewers', {
        ticketId: previousTicketId,
        viewerIds: this.ticketViewers.getViewerIds(previousTicketId),
      });
    }

    const ticket = await this.chatService.getTicketForParticipant(dto.ticketId, user);

    // A disconnect landing during the DB round trip above already ran
    // handleDisconnect, which read client.data.currentTicketId (set
    // synchronously above, before this await) and called ticketViewers.leave
    // — a no-op, since the join below hadn't happened yet. Registering the
    // viewer now would create an entry disconnect already fired for and
    // will never fire for again: a permanent phantom "viewing this ticket"
    // banner for everyone else, and an unbounded ticketViewers/adapter.rooms
    // leak. Bail out before doing anything socket.io- or state-visible.
    if (client.disconnected) {
      return;
    }

    await client.join(ticketRoom(ticket.id));

    this.ticketViewers.join(ticket.id, client.id, user.sub);
    this.server.to(ticketRoom(ticket.id)).emit('ticket:viewers', {
      ticketId: ticket.id,
      viewerIds: this.ticketViewers.getViewerIds(ticket.id),
    });

    // Tagged with the ticketId it belongs to — unlike every sibling handler
    // (onMessage/onMessageEdited/onViewers), the client-side listener has no
    // other way to tell this apart from a slower, still-in-flight response
    // to a PREVIOUS ticket:join for a ticket the user has since navigated
    // away from (fast row-to-row navigation can leave two of these DB round
    // trips in flight at once). Without the tag, a late response for the
    // old ticket can land after the new ticket's own listener is already
    // registered and get shown as if it were the new ticket's history.
    const history = await this.chatService.getHistory(ticket.id, user);
    client.emit('ticket:history', { ticketId: ticket.id, history });
  }

  // Returns the created comment as the Socket.IO ack — the composer's
  // stage-then-send flow needs the new comment's id synchronously, to
  // attach any staged files to it via a follow-up REST upload.
  //
  // Uses @Ack() and calls it explicitly (both on success AND on error) —
  // NestJS's default auto-ack (a plain return value wired to the client's
  // callback) only fires on a normal return. A THROWN exception (closed/
  // trashed ticket, not-a-participant, ...) instead goes through Nest's
  // default WS exception handling, which just does `client.emit('exception',
  // ...)` — a completely separate event nobody in this codebase listens for
  // — and never touches the pending ack callback at all. From the sender's
  // point of view that looked identical to the server hanging: the composer
  // sat on "Отправляем…" for the full 10s client-side ack timeout, then
  // failed with a generic "operation has timed out" instead of the real,
  // specific reason. Found live during a large-scale workflow simulation
  // (a client replying right as their ticket got closed by an operator).
  @SubscribeMessage('ticket:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
    @Ack() ack: (response: PublicComment | { error: true; message: string }) => void,
  ): Promise<void> {
    try {
      const user = this.requireUser(client);
      const ticket = await this.chatService.getTicketForParticipant(dto.ticketId, user);

      const { comment, mentionedUserIds } = await this.chatService.postMessage(ticket, user, dto.body, dto.isInternal ?? false);
      await this.broadcastMessage(client, user, ticket, comment, mentionedUserIds);
      ack(comment);
    } catch (err) {
      const message = err instanceof WsException ? err.message : 'Не удалось отправить сообщение';
      ack({ error: true, message });
    }
  }

  private async broadcastMessage(
    client: Socket,
    user: JwtPayload,
    ticket: TicketEntity,
    comment: PublicComment,
    mentionedUserIds: string[],
  ): Promise<void> {
    // An internal comment must never reach the client's own socket, even
    // though they're a member of the same ticket room — broadcasting it
    // there instead of to the room would leak it live, regardless of
    // getHistory filtering it out on the next reload. It also must not
    // reach staff who couldn't otherwise see this ticket at all (a
    // department- or own-tickets-restricted operator) — emitToStaffWhoCanSeeTicket
    // re-checks that per socket, since OPERATORS_ROOM has no such scoping.
    if (comment.isInternal) {
      await this.emitToStaffWhoCanSeeTicket(ticket, 'ticket:message', comment);
    } else {
      this.server.to(ticketRoom(ticket.id)).emit('ticket:message', comment);
    }

    // Live-chat replies only ever reached this same event via the slower
    // email-ingestion path before (ticket-events-subscriber.service.ts) —
    // that path stays for actual email replies, but the far more common
    // case (an operator or client typing in the chat panel) never fired a
    // notification at all. Internal notes never notify the client — same
    // reasoning as the broadcast above.
    if (!comment.isInternal) {
      const notification: TicketEventPayload = {
        type: 'reply',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: toPublicTicketStatus(ticket.status),
        teamId: ticket.teamId,
        assignedTo: ticket.assignedTo,
        createdBy: ticket.createdBy,
      };
      if (user.role === UserRole.CLIENT) {
        // Same confidentiality gap already fixed above for internal
        // messages (and on the sibling 'created'/'updated'/'attachment'
        // channel in TicketEventsSubscriberService) — OPERATORS_ROOM has no
        // per-recipient scoping, so a department- or own-tickets-restricted
        // operator would otherwise receive this ticket's title/number/status
        // over the wire regardless of whether they can see it over REST.
        await this.emitToStaffWhoCanSeeTicket(ticket, 'ticket:notification', notification, user.sub);
      } else {
        // `client.to(...)` excludes the sender, so nobody hears/sees a
        // notification for their own message. This branch targets the
        // client's own room, not staff, so no restrictToDepartments-style
        // scoping applies here.
        client.to(userRoom(ticket.createdBy)).emit('ticket:notification', notification);
      }
    }

    // Same live-push channel as a reply, one per mentioned staff member —
    // chat.service.ts already resolved and deduped this list (never
    // includes the author, and never overlaps who already got a REPLY
    // notification above for this same message). Same internal-note leak
    // guard as the reply branch above (and as chat.service.ts's own
    // persisted-notification loop) — this is an independent push path, not
    // downstream of that one, so it needs its own check rather than
    // trusting the caller already filtered it out.
    for (const mentionedId of mentionedUserIds) {
      if (comment.isInternal && mentionedId === ticket.createdBy) continue;
      const mentionNotification: TicketEventPayload = {
        type: 'mention',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: toPublicTicketStatus(ticket.status),
        teamId: ticket.teamId,
        assignedTo: ticket.assignedTo,
        createdBy: ticket.createdBy,
      };
      client.to(userRoom(mentionedId)).emit('ticket:notification', mentionNotification);
    }

    // A colleague's message on YOUR ticket (public reply or internal note)
    // should reach you even though it isn't a client reply — the branches
    // above only cover the client-creator and the operators-room broadcast
    // for client messages. Skip if the assignee wrote it themselves or was
    // just mentioned (already notified with the more specific toast).
    if (
      user.role !== UserRole.CLIENT &&
      ticket.assignedTo &&
      ticket.assignedTo !== user.sub &&
      !mentionedUserIds.includes(ticket.assignedTo)
    ) {
      const assigneeNotification: TicketEventPayload = {
        type: 'reply',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: toPublicTicketStatus(ticket.status),
        teamId: ticket.teamId,
        assignedTo: ticket.assignedTo,
        createdBy: ticket.createdBy,
      };
      client.to(userRoom(ticket.assignedTo)).emit('ticket:notification', assigneeNotification);
    }
  }

  // Same @Ack()-plus-try/catch treatment as handleMessage above, and for the
  // identical reason — a thrown exception here (closed/trashed ticket, no
  // such comment, not-the-author) used to fall through Nest's default WS
  // exception handling, which only does `client.emit('exception', ...)` and
  // never touches the pending ack callback. The composer's edit UI would
  // just hang until the client-side ack timeout, with no server log line
  // either (WsLoggingExceptionFilter deliberately skips logger.error for
  // WsException and instead recovers via the ack callback — which never
  // existed on the raw fire-and-forget emit this replaces).
  @SubscribeMessage('ticket:message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: EditMessageDto,
    @Ack() ack: (response: PublicComment | { error: true; message: string }) => void,
  ): Promise<void> {
    try {
      const user = this.requireUser(client);
      const ticket = await this.chatService.getTicketForParticipant(dto.ticketId, user);

      const comment = await this.chatService.editMessage(ticket, user, dto.commentId, dto.body);
      // Same leak concern as handleMessage above — an edited internal note
      // must stay out of the client's socket, and out of staff restricted
      // away from this ticket entirely.
      if (comment.isInternal) {
        await this.emitToStaffWhoCanSeeTicket(ticket, 'ticket:message:edited', comment);
      } else {
        this.server.to(ticketRoom(ticket.id)).emit('ticket:message:edited', comment);
      }
      ack(comment);
    } catch (err) {
      const message = err instanceof WsException ? err.message : 'Не удалось изменить сообщение';
      ack({ error: true, message });
    }
  }

  // Same per-ticket authorization every other ticket-scoped handler enforces
  // — without it, any authenticated socket could broadcast a fabricated
  // "typing" indicator into any ticket room it can guess/enumerate a UUID
  // for, reaching that ticket's real participants without ever having
  // joined it.
  @SubscribeMessage('ticket:typing')
  async handleTyping(@ConnectedSocket() client: Socket, @MessageBody() dto: JoinTicketDto): Promise<void> {
    const user = this.requireUser(client);
    await this.chatService.getTicketForParticipant(dto.ticketId, user);
    // ticketId included so a recipient who just navigated to a different
    // ticket (ticket:leave/ticket:join are separate async emits, no
    // ordering guarantee against a still-in-flight broadcast from the room
    // just left) can filter it out client-side instead of showing a stale
    // "is typing" for the wrong ticket — same guard every other
    // ticket-scoped event (history/message/edited/viewers) already applies.
    client.to(ticketRoom(dto.ticketId)).emit('ticket:typing', { userId: user.sub, ticketId: dto.ticketId });
  }

  // Without this, a socket that visits several tickets in one session stays
  // joined to every room it ever entered — an unbounded membership leak, and
  // it would keep receiving ticket:message broadcasts for tickets it's no
  // longer looking at.
  //
  // Deliberately NOT gated by getTicketForParticipant, unlike its siblings —
  // a client must always be able to leave a room/clear its viewer entry even
  // if its access to that ticket changed mid-session (e.g. an operator's
  // permission group lost that department while they had the ticket open);
  // client.leave()/ticketViewers.leave() are harmless no-ops for a ticket the
  // caller was never actually in, so there's nothing here worth blocking on.
  @SubscribeMessage('ticket:leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() dto: JoinTicketDto): void {
    this.requireUser(client);
    void client.leave(ticketRoom(dto.ticketId));

    this.ticketViewers.leave(dto.ticketId, client.id);
    if (client.data.currentTicketId === dto.ticketId) {
      client.data.currentTicketId = undefined;
    }
    this.server.to(ticketRoom(dto.ticketId)).emit('ticket:viewers', {
      ticketId: dto.ticketId,
      viewerIds: this.ticketViewers.getViewerIds(dto.ticketId),
    });
  }

  // The employee explicitly picking a status from the catalog (or clearing
  // it back to «Онлайн» with statusId: null) — always cancels any auto-idle
  // state, since making the choice is itself activity.
  @SubscribeMessage('presence:set-status')
  async handleSetStatus(@ConnectedSocket() client: Socket, @MessageBody() dto: SetStatusDto): Promise<void> {
    const user = this.requireUser(client);
    if (user.role === UserRole.CLIENT) return;
    const changed = await this.employeeStatus.setManualStatus(user.sub, dto.statusId ?? null);
    if (changed) {
      this.server.emit('presence:operators', this.presencePayload());
    }
  }

  // Client-side idle detection (see useIdleReporter) reports crossing the
  // configured inactivity threshold — the server trusts the signal rather
  // than tracking its own heartbeats, same tradeoff PresenceService already
  // accepts by being purely connection-based.
  @SubscribeMessage('presence:idle')
  async handleIdle(@ConnectedSocket() client: Socket): Promise<void> {
    const user = this.requireUser(client);
    if (user.role === UserRole.CLIENT) return;
    const changed = await this.employeeStatus.setIdle(user.sub);
    if (changed) {
      this.server.emit('presence:operators', this.presencePayload());
    }
  }

  @SubscribeMessage('presence:active')
  async handleActive(@ConnectedSocket() client: Socket): Promise<void> {
    const user = this.requireUser(client);
    if (user.role === UserRole.CLIENT) return;
    const changed = await this.employeeStatus.setActive(user.sub);
    if (changed) {
      this.server.emit('presence:operators', this.presencePayload());
    }
  }

  // excludeUserId skips one user's own room — the operator who caused a
  // shared event (filed a ticket on a client's behalf) shouldn't be
  // notified about their own action.
  broadcastToOperators(event: string, payload: unknown, excludeUserId?: string): void {
    const target = this.server.to(OPERATORS_ROOM);
    (excludeUserId ? target.except(userRoom(excludeUserId)) : target).emit(event, payload);
  }

  // Targeted delivery to one user's own room (every socket joins theirs on
  // connect, staff included) — for events that belong to a single person,
  // like 'assigned', where an operators-room broadcast would tell everyone
  // «Вам назначен тикет».
  broadcastToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  // Admin-only targeted broadcast — mirrors broadcastToOperators, scoped to
  // ADMINS_ROOM instead (see UserEventsSubscriberService, the only caller).
  broadcastToAdmins(event: string, payload: unknown): void {
    this.server.to(ADMINS_ROOM).emit(event, payload);
  }

  // Driven by UsersService.deactivate via UserEventsSubscriberService — a
  // socket only gets JWT-checked once, at handshake (see WsAuthService), so
  // an already-open tab would otherwise keep working indefinitely after
  // deactivation. Emits an explicit event first (rather than relying on the
  // client inferring meaning from a bare disconnect, which can happen for
  // unrelated reasons) so the frontend can log out cleanly before the
  // connection actually closes.
  async forceDisconnectUser(userId: string): Promise<void> {
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    for (const socket of sockets) {
      socket.emit('account:deactivated');
      socket.disconnect(true);
    }
  }

  // Any staff-wide ticket event must reach exactly the staff who could
  // already see this ticket over REST, not every connected operator/admin
  // app-wide — OPERATORS_ROOM used to be (and, via broadcastToOperators, for
  // internal chat messages used to still be) the target directly, which let
  // a department- or own-tickets-restricted operator read content on
  // tickets they have no access to at all, just by having any socket
  // connection open (no need to even view the ticket — the frontend's own
  // staffCanSeeTicket check on receipt only no-ops the toast/highlight, it
  // doesn't stop the payload arriving — see TicketEventPayload's own comment,
  // which documented this as the deliberate-but-wrong original design for
  // the 'created'/'updated'/'attachment' channel until this fix). Originally
  // built for internal chat messages only (postMessage/editMessage below);
  // TicketEventsSubscriberService now reuses it for that same reason on the
  // sibling ticket-metadata channel. fetchSockets() is safe to read
  // .data.user off of here because chat-service still runs single-instance
  // (no Redis socket.io adapter) — every "remote" socket it returns is
  // actually local, data included.
  async emitToStaffWhoCanSeeTicket(
    ticket: { createdBy: string; assignedTo?: string | null; teamId?: string | null },
    event: string,
    payload: unknown,
    excludeUserId?: string,
  ): Promise<void> {
    const sockets = await this.server.in(OPERATORS_ROOM).fetchSockets();
    for (const socket of sockets) {
      const user = socket.data.user as JwtPayload | undefined;
      if (user && user.sub !== excludeUserId && staffCanSeeTicket(user, ticket)) {
        socket.emit(event, payload);
      }
    }
  }

  // Defensive only — the afterInit middleware guarantees client.data.user is
  // set before 'connection' (and therefore any @SubscribeMessage handler)
  // can fire at all, so this should be unreachable in normal operation.
  // Deliberately does NOT force-disconnect: a server-initiated disconnect
  // doesn't auto-reconnect client-side (see afterInit's comment) and would
  // trade one dead-socket bug for another. WsException reaches the client as
  // a catchable 'exception' event instead.
  private requireUser(client: Socket): JwtPayload {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) {
      throw new WsException('Unauthenticated socket');
    }
    return user;
  }
}
