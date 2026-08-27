import { UserRole } from '@veloxdesk/types';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

function createContext(user?: { role: UserRole }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when the route has no @Roles() requirement', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('denies access when the user role is not in the required list', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: UserRole.CLIENT }))).toBe(false);
  });

  it('allows access when the user role matches one of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN, UserRole.OPERATOR],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: UserRole.OPERATOR }))).toBe(true);
  });

  it('denies access when there is no authenticated user on the request', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });
});
