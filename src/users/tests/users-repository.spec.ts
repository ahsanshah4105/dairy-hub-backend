import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { CreateUserData, UsersRepository } from '../repositories/users.repository';

// Lightweight TypeORM repository double — only the methods UsersRepository calls.
const makeTypeOrmRepoMock = () => ({
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const makeAdminUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    passwordHash: 'hashed:secret',
    role: UserRole.ADMIN,
    phoneNumber: null,
    emailVerifiedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    reports: [],
    ...overrides,
  } as User);

describe('UsersRepository', () => {
  let usersRepository: UsersRepository;
  let typeOrmRepo: jest.Mocked<Pick<Repository<User>, 'create' | 'save' | 'findOne' | 'delete' | 'createQueryBuilder'>>;

  beforeEach(async () => {
    typeOrmRepo = makeTypeOrmRepoMock() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: getRepositoryToken(User),
          useValue: typeOrmRepo,
        },
      ],
    }).compile();

    usersRepository = module.get<UsersRepository>(UsersRepository);
  });

  // ─── save() — role preservation ───────────────────────────────────────────

  describe('save()', () => {
    it('should pass the user to TypeORM save without modifying role', async () => {
      // Regression guard: save() must never override role.
      // If someone adds role-overriding logic to save(), this test will catch it.
      const admin = makeAdminUser();
      typeOrmRepo.save.mockResolvedValue(admin);

      const result = await usersRepository.save(admin);

      // save() must forward the exact object — not a spread with an overridden role.
      expect(typeOrmRepo.save).toHaveBeenCalledWith(admin);
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should preserve USER role when saving a regular user', async () => {
      const regularUser = makeAdminUser({ id: 'user-1', role: UserRole.USER });
      typeOrmRepo.save.mockResolvedValue(regularUser);

      const result = await usersRepository.save(regularUser);

      expect(typeOrmRepo.save).toHaveBeenCalledWith(regularUser);
      expect(result.role).toBe(UserRole.USER);
    });
  });

  // ─── create() — role from data ────────────────────────────────────────────

  describe('create()', () => {
    it('should forward provided role to TypeORM repository.create()', () => {
      // Before the fix, create() hardcoded role: UserRole.USER regardless of data.
      // After the fix, the caller-provided role flows through unchanged so that
      // RegistrationPolicy (not the repository) decides which role is assigned.
      const data: CreateUserData = {
        name: 'Employee',
        email: 'employee@example.com',
        passwordHash: 'hash',
        role: UserRole.ADMIN, // deliberately use ADMIN to prove it is NOT silently overridden
      };

      typeOrmRepo.create.mockReturnValue({ ...data } as User);

      usersRepository.create(data);

      expect(typeOrmRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
    });

    it('should not inject a default role when none is provided', () => {
      // If role is omitted, the TypeORM entity default (UserRole.USER) applies
      // at the DB level — the repository must not inject its own default.
      const data: CreateUserData = {
        name: 'Plain',
        email: 'plain@example.com',
        passwordHash: 'hash',
      };

      typeOrmRepo.create.mockReturnValue({ ...data } as User);

      usersRepository.create(data);

      // role should NOT be added by the repository itself
      expect(typeOrmRepo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ role: expect.anything() }),
      );
    });
  });
});
