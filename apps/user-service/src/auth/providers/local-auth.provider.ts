import { UserEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service.js';

// No real password ever produces this hash — it exists purely so validate()
// can run a bcrypt.compare() of the same cost even when the email doesn't
// resolve to a real user. Without it, a nonexistent-email response returns
// measurably faster than a wrong-password response for a real account
// (bcrypt.compare is ~60-100ms of deliberate work, skipped entirely by the
// short-circuit on a null user) — a classic account-enumeration timing
// side-channel.
const DUMMY_PASSWORD_HASH = '$2b$10$KBmCRMddCirCcLA1Fw0MA.ii9onncWPa7ieWXM0KNjfgOWykQbiFG';

// The original AuthService.login() credential check, extracted verbatim —
// zero behavior change for existing local accounts. Deliberately returns
// the full UserEntity (unlike DirectoryCredentialProvider.validate, which
// returns a bare AuthenticatedIdentity) since a local account already
// lives in VeloxDesk's own DB; there's no JIT-provisioning step to do.
@Injectable()
export class LocalAuthProvider {
  constructor(private readonly usersService: UsersService) {}

  async validate(email: string, password: string): Promise<UserEntity | null> {
    // withDeleted so a deactivated account still resolves here — AuthService
    // gives it a distinct "deactivated" message rather than folding that
    // into an indistinguishable invalid-credentials response.
    const user = await this.usersService.findByEmail(email, { withDeleted: true });
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    return user && passwordMatches ? user : null;
  }
}
