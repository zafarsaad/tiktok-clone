// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

// We are using a global variable to avoid hot-reloading issues with serverless environments.
// in Dev, globalThis is not reset between hot-reloads
declare global {
    // allow global `var` declarations
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

export const prisma =
    global.prisma ||
    new PrismaClient({
        // Optional: Enable logging to see executed queries
        // log: ['query', 'info', 'warn', 'error'],
    });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;