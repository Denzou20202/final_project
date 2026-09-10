// Same ephemeral, best-effort live-UI-update contract as ticket-event.ts,
// just for account-lifecycle events instead of ticket ones — kept as a
// separate channel/type rather than folded into TicketEventPayload since
// this has nothing to do with a ticket (no ticketId/ticketNumber exist yet).
export const USER_EVENTS_CHANNEL = 'user-events';

// Admin-facing — a new self-registration is awaiting approval.
export interface RegistrationPendingEvent {
  type: 'registration_pending';
  userId: string;
  email: string;
  fullName: string;
}

// Targets the deactivated user's own socket — chat-service force-disconnects
// it on receipt (see ChatGateway.forceDisconnectUser). Without this, a
// still-open tab keeps its already-issued access token working (sockets
// only check the JWT once, at handshake) until the tab is closed/reloaded.
export interface AccountDeactivatedEvent {
  type: 'account_deactivated';
  userId: string;
}

// Same force-disconnect purpose as AccountDeactivatedEvent, fired instead
// when the account is hard-deleted (see UsersService.hardDelete) rather than
// just soft-deleted — a distinct type so a reader of the subscriber never has
// to wonder why a "deactivated" event fires for a row that no longer exists.
export interface AccountDeletedEvent {
  type: 'account_deleted';
  userId: string;
}

// Same force-disconnect purpose as AccountDeactivatedEvent, fired instead
// when the account itself stays active but something security-relevant
// about it changed: role, permission-group assignment, the cannotManageAdmins
// restriction, or a whole permission group's own policy (requireTwoFactor/
// ipWhitelist/restrictToDepartments/restrictToOwnTickets — see
// PermissionGroupsService.update/remove, which fires this once per member).
// An already-issued access token keeps its OLD claims for the rest of its
// TTL regardless (JwtStrategy only re-checks that the row still exists, not
// that role/permissionGroupId still match — see that file's own comment),
// so this is a partial mitigation, not a full close: it kicks any live
// socket immediately and blocks silent refresh, but a still-valid access
// token remains usable over REST for up to its remaining TTL. Combined with
// UsersRepository.setRefreshTokenHash(id, null) at every publish site, so
// the account is forced through a real re-login (minting fresh claims) the
// next time its access token expires, rather than silently refreshing.
export interface AccountSecurityChangedEvent {
  type: 'account_security_changed';
  userId: string;
}

export type UserEventType = UserEventPayload['type'];

export type UserEventPayload =
  | RegistrationPendingEvent
  | AccountDeactivatedEvent
  | AccountDeletedEvent
  | AccountSecurityChangedEvent;
