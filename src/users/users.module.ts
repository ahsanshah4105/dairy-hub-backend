import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserProfile } from './infrastructure/persistence/user-profile.entity';
import { TypeOrmUserProfileRepository } from './infrastructure/persistence/user-profile.repository';
import { UsersService } from './application/users.service';
import { AuthEventListener } from './application/listeners/auth-event.listener';
import { UsersController } from './presentation/users.controller';
import { USER_PROFILE_REPOSITORY } from './domain/ports/user-profile.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProfile]),
    AuthModule, // Import to use JwtAuthGuard & AuthIdentityRepository
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    AuthEventListener,
    // Port → Adapter binding
    { provide: USER_PROFILE_REPOSITORY, useClass: TypeOrmUserProfileRepository },
  ],
})
export class UsersModule {}
