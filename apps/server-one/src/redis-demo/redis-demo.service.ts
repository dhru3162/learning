import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

const MOCK_API_URL = 'https://6aedc2e3a677fe0fc14f5090.mockapi.io/api/users';
const CACHE_TTL = 120;

@Injectable()
export class RedisDemoService {
  private readonly logger = new Logger(RedisDemoService.name);

  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  async getMockUsers() {
    const cacheKey = 'mockapi:users:all';
    const cachedData = await this.redis.get(cacheKey);

    if (cachedData) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return {
        source: 'redis-cache',
        data: JSON.parse(cachedData),
      };
    }

    this.logger.log(
      `Cache MISS for key: ${cacheKey}. Fetching from MockAPI...`,
    );
    const response = await fetch(MOCK_API_URL);

    if (!response.ok) {
      throw new HttpException(
        `Failed to fetch users: ${response.statusText}`,
        response.status,
      );
    }

    const users = await response.json();
    await this.redis.set(cacheKey, JSON.stringify(users), 'EX', CACHE_TTL);

    return {
      source: 'mockapi',
      data: users,
    };
  }

  async getMockUserById(id: string) {
    const cacheKey = `mockapi:users:${id}`;
    const cachedData = await this.redis.get(cacheKey);

    if (cachedData) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return {
        source: 'redis-cache',
        data: JSON.parse(cachedData),
      };
    }

    this.logger.log(
      `Cache MISS for key: ${cacheKey}. Fetching from MockAPI...`,
    );
    const response = await fetch(`${MOCK_API_URL}/${id}`);

    if (response.status === 404) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (!response.ok) {
      throw new HttpException(
        `Failed to fetch user: ${response.statusText}`,
        response.status,
      );
    }

    const user = await response.json();
    await this.redis.set(cacheKey, JSON.stringify(user), 'EX', CACHE_TTL);

    return {
      source: 'mockapi',
      data: user,
    };
  }

  async createMockUser(userData: any) {
    const response = await fetch(MOCK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new HttpException(
        `Failed to create user: ${response.statusText}`,
        response.status,
      );
    }

    const newUser = await response.json();

    if (newUser?.id) {
      await this.redis.set(
        `mockapi:users:${newUser.id}`,
        JSON.stringify(newUser),
        'EX',
        CACHE_TTL,
      );
    }

    await this.redis.del('mockapi:users:all');
    this.logger.log(`Invalidated cache for mockapi:users:all`);

    return {
      message: 'User created successfully',
      source: 'mockapi',
      data: newUser,
    };
  }

  async updateMockUser(id: string, userData: any) {
    const response = await fetch(`${MOCK_API_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (response.status === 404) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (!response.ok) {
      throw new HttpException(
        `Failed to update user: ${response.statusText}`,
        response.status,
      );
    }

    const updatedUser = await response.json();

    await this.redis.set(
      `mockapi:users:${id}`,
      JSON.stringify(updatedUser),
      'EX',
      CACHE_TTL,
    );

    await this.redis.del('mockapi:users:all');
    this.logger.log(
      `Updated cache for user ${id} and invalidated mockapi:users:all`,
    );

    return {
      message: 'User updated successfully',
      source: 'mockapi',
      data: updatedUser,
    };
  }

  async deleteMockUser(id: string) {
    const response = await fetch(`${MOCK_API_URL}/${id}`, {
      method: 'DELETE',
    });

    if (response.status === 404) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (!response.ok) {
      throw new HttpException(
        `Failed to delete user: ${response.statusText}`,
        response.status,
      );
    }

    const deletedUser = await response.json();

    await this.redis.del(`mockapi:users:${id}`);
    await this.redis.del('mockapi:users:all');
    this.logger.log(
      `Deleted cache for user ${id} and invalidated mockapi:users:all`,
    );

    return {
      message: 'User deleted successfully',
      source: 'mockapi',
      data: deletedUser,
    };
  }

  async create(key: string, value: any) {
    await this.redis.set(key, JSON.stringify(value));

    return {
      message: 'Data created successfully',
      key,
    };
  }

  async findOne(key: string) {
    const data = await this.redis.get(key);

    return data ? JSON.parse(data) : null;
  }

  async update(key: string, value: any) {
    const exists = await this.redis.exists(key);

    if (!exists) {
      return {
        message: 'Data not found',
      };
    }

    await this.redis.set(key, JSON.stringify(value));

    return {
      message: 'Data updated successfully',
    };
  }

  async remove(key: string) {
    const result = await this.redis.del(key);

    return {
      deleted: result > 0,
    };
  }
}
