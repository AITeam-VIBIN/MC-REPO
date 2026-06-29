import { PrismaClient } from '@prisma/client';
import env from './env.js';

let prismaInstance = null;

/**
 * Retrieves the Prisma Client database singleton instance.
 * Ensures only one connection pool exists throughout the application lifecycle.
 * 
 * @function getPrismaClient
 * @returns {PrismaClient} Instantiated database connector client
 */
export function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_URL,
        },
      },
      log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

export const prisma = getPrismaClient();
export default prisma;
