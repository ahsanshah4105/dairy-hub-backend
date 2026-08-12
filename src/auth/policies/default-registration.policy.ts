import { ForbiddenException, Injectable } from '@nestjs/common';

import { UserRole } from '../../users/enums/user-role.enum';
import { RegistrationPolicy } from './registration-policy.interface';

@Injectable()
export class DefaultRegistrationPolicy implements RegistrationPolicy<UserRole> {
  resolveRole(requestedRole?: string): UserRole {
    if (!requestedRole) {
      return UserRole.USER;
    }

    if (requestedRole === UserRole.ADMIN) {
      throw new ForbiddenException('This role cannot self-register');
    }

    if (!Object.values(UserRole).includes(requestedRole as UserRole)) {
      throw new ForbiddenException('Invalid registration role');
    }

    return requestedRole as UserRole;
  }
}
