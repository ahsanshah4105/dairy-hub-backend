import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthIdentity, UserRole } from './auth-identity.entity';

@Injectable()
export class AuthIdentityRepository {
  constructor(
    @InjectRepository(AuthIdentity)
    private readonly repository: Repository<AuthIdentity>,
  ) { }

  async findById(id: string): Promise<AuthIdentity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByPhoneNumber(phoneNumber: string): Promise<AuthIdentity | null> {
    return this.repository.findOne({ where: { phoneNumber } });
  }

  async findOrCreate(phoneNumber: string): Promise<{ identity: AuthIdentity; isNew: boolean }> {
    let identity = await this.findByPhoneNumber(phoneNumber);
    if (identity) {
      return { identity, isNew: false };
    }

    identity = this.repository.create({ phoneNumber });
    identity = await this.repository.save(identity);
    return { identity, isNew: true };
  }


  async createIdentity(phoneNumber: string, role?: any): Promise<AuthIdentity> {
    const identity = this.repository.create({ phoneNumber, role });
    return this.repository.save(identity);
  }



  async save(identity: AuthIdentity): Promise<AuthIdentity> {
    return this.repository.save(identity);
  }

  async remove(identity: AuthIdentity): Promise<void> {
    await this.repository.delete(identity.id);
  }
}
