import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthIdentity } from '../../infrastructure/persistence/auth-identity.entity';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthIdentity => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
