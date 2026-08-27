// What a successful LDAP bind or OIDC callback hands to
// UsersService.provisionFromDirectory — enough to find-or-create the
// VeloxDesk account. Lives in users/ (not auth/providers/) since
// provisioning is a UsersService concern; the LDAP/OIDC providers that
// PRODUCE this just import the shape from here.
export interface AuthenticatedIdentity {
  // The directory's stable subject id (AD objectGUID/LDAP entryUUID, or the
  // OIDC `sub` claim) — see UserEntity.externalId.
  externalId: string;
  email: string;
  fullName: string;
}
