import { Injectable } from '@nestjs/common';
import { User } from './user.model.js';

const users: User[] = [
  {
    id: 1,
    name: 'John',
    email: 'john@example.com',
  },
  {
    id: 2,
    name: 'Jane',
    email: 'jane@example.com',
  },
];

@Injectable()
export class UsersService {
  findAll(): User[] {
    return users;
  }

  findOne(id: number): User | undefined {
    return users.find((user) => user.id === id);
  }

  create(name: string, email: string): User {
    const newUser: User = {
      id: Math.max(0, ...users.map((user) => user.id)) + 1,
      name,
      email,
    };

    users.push(newUser);

    return newUser;
  }
}
