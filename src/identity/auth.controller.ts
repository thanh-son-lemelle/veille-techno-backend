import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { registerSchema, type RegisterInputDto } from './registerDto.schema';
import { loginSchema, type LoginInputDto } from './loginDto.schema';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    description:
      'Un email au format valide et un mot de passe non vide sont obligatoires. Aucun autre champ n’est accepté.',
    examples: {
      connexion: {
        value: { email: 'alice@example.com', password: 'MotDePasse123!' },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Connexion réussie. Le JWT est valable une heure et contient sub, iat et exp, sans mot de passe ni hash.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/AuthToken' },
        example: { accessToken: '<JWT>' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Données de connexion invalides : email mal formé ou mot de passe absent ou vide',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['statusCode', 'message', 'error'],
          properties: {
            statusCode: { type: 'integer' },
            message: { type: 'array', items: { type: 'string' } },
            error: { type: 'string' },
          },
        },
        example: {
          statusCode: 400,
          message: ['email: Adresse email invalide'],
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Email inconnu ou mot de passe incorrect, sans distinction',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['statusCode', 'message', 'error'],
          properties: {
            statusCode: { type: 'integer' },
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
        example: {
          statusCode: 401,
          message: 'Identifiants invalides.',
          error: 'Unauthorized',
        },
      },
    },
  })
  @UsePipes(StandardSchemaValidationPipe)
  login(@Body({ schema: loginSchema }) input: LoginInputDto) {
    return this.authService.login(input);
  }

@Post('register')
@ApiBody({
  description:
    'Le nom est débarrassé des espaces en début et fin, puis doit être non vide.',
})
@ApiCreatedResponse({
  description: 'Utilisateur créé',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/User' },
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'alice@example.com',
        name: 'Alice',
        role: 'user',
        createdAt: '2026-09-25T10:00:00.000Z',
      },
    },
  },
})
@ApiBadRequestResponse({
  description: 'Données d’inscription invalides',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['statusCode', 'message', 'error'],
        properties: {
          statusCode: { type: 'integer' },
          message: { type: 'array', items: { type: 'string' } },
          error: { type: 'string' },
        },
      },
      example: {
        statusCode: 400,
        message: ['email: Adresse email invalide'],
        error: 'Bad Request',
      },
    },
  },
})
@ApiConflictResponse({
  description: 'Email déjà utilisé',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['statusCode', 'message', 'error'],
        properties: {
          statusCode: { type: 'integer' },
          message: { type: 'string' },
          error: { type: 'string' },
        },
      },
      example: {
        statusCode: 409,
        message: 'Cet email est déjà utilisé.',
        error: 'Conflict',
      },
    },
  },
})
@UsePipes(StandardSchemaValidationPipe)
register(@Body({ schema: registerSchema }) input: RegisterInputDto) {
  return this.authService.register(input);
}
}