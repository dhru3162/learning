import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { UsersModule } from './users/users.module.js';
import { VideosModule } from './videos/videos.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RedisDemoModule } from './redis-demo/redis-demo.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      graphiql: true,
    }),
    UsersModule,
    VideosModule,
    RedisModule,
    RedisDemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
