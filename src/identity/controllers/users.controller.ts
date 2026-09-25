import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  StandardSchemaValidationPipe,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth.guard';
import {
  updateUserSchema,
  type UpdateUserInputDto,
} from '../dtos/updateUserDto.schema';
import { UsersService } from '../services/users.service';

@Controller('api/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Patch(':id')
  @UseGuards(AuthGuard)
  @UsePipes(StandardSchemaValidationPipe)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateUserSchema }) input: UpdateUserInputDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.update(request.user, id, input);
  }
}