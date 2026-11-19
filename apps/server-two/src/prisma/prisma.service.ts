/**
 * PrismaService (Prisma 7 with pg Driver Adapter)
 *
 * In Prisma 7, database connections use driver adapters (like @prisma/adapter-pg).
 * We instantiate a pg.Pool connection pool and pass the PrismaPg adapter
 * to super({ adapter }).
 */

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env['DATABASE_URL'] || '';

    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
