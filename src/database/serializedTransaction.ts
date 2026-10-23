import { SQLiteDatabase } from 'expo-sqlite';

// expo-sqlite comparte la conexión del contexto: dos BEGIN simultáneos se pisan.
const transactionQueues = new WeakMap<SQLiteDatabase, Promise<void>>();

export async function withSerializedTransaction(
  db: SQLiteDatabase,
  task: () => Promise<void>
): Promise<void> {
  const previous = transactionQueues.get(db) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  transactionQueues.set(db, current);

  await previous;
  try {
    await db.withTransactionAsync(task);
  } finally {
    release();
    if (transactionQueues.get(db) === current) transactionQueues.delete(db);
  }
}
