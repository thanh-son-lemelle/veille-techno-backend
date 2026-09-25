import {
  Body,
  Controller,
  Post,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { registerSchema, type RegisterInputDto } from './registerDto.schema';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(StandardSchemaValidationPipe)
  register(@Body({ schema: registerSchema }) input: RegisterInputDto) {
    return this.authService.register(input);
  }
}