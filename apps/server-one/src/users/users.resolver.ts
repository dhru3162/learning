import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from './user.model.js';
import { UsersService } from './users.service.js';
import { CreateUserInput } from './create-user.input.js';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User], { name: 'users' })
  findAll(): User[] {
    return this.usersService.findAll();
  }

  @Query(() => User, { name: 'user', nullable: true })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.usersService.findOne(id) ?? null;
  }

  @Mutation(() => User, { name: 'createUser' })
  createUser(@Args('input') input: CreateUserInput): User {
    return this.usersService.create(input.name, input.email);
  }
}
