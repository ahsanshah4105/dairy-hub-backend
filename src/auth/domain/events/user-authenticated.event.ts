export class UserAuthenticatedEvent {
  constructor(
    public readonly userId: string,
    public readonly phoneNumber: string,
    public readonly isNewIdentity: boolean,
    public readonly name?: string,
  ) { }
}
