export const REGISTRATION_POLICY = Symbol('REGISTRATION_POLICY');

export interface RegistrationPolicy<TRole extends string> {
  resolveRole(requestedRole?: string): TRole;
}
