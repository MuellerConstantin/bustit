export class UsernameTakenError extends Error {
  constructor(readonly username: string) {
    super(`Username ${username} is taken`);
    this.name = 'UsernameTakenError';
  }
}

export class UserNotFoundError extends Error {
  constructor(readonly userId: string) {
    super(`No user ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

export class SelfDeletionError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} can't delete themselves`);
    this.name = 'SelfDeletionError';
  }
}
