export class TableNameTakenError extends Error {
  constructor(readonly tableName: string) {
    super(`Table name ${tableName} is taken`);
    this.name = 'TableNameTakenError';
  }
}

export class TableNotFoundError extends Error {
  constructor(readonly tableId: string) {
    super(`No table ${tableId}`);
    this.name = 'TableNotFoundError';
  }
}
