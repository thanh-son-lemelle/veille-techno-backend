import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  type SchemaObject,
} from '@nestjs/swagger';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth.guard';
import {
  updateUserSchema,
  type UpdateUserInputDto,
} from '../dtos/updateUserDto.schema';
import { UsersService } from '../services/users.service';

const httpErrorSchema: SchemaObject = {
  type: 'object',
  required: ['statusCode', 'message', 'error'],
  properties: {
    statusCode: { type: 'integer' },
    message: { type: 'string' },
    error: { type: 'string' },
  },
};

@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
@Controller('api/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Patch(':id')
  @ApiOperation({
    summary: "Modifier les informations d'un utilisateur (y compris ses droits)",
    description:
      'Un utilisateur peut modifier son propre nom et son email. Un administrateur peut modifier tout profil et changer son rôle. Un non-admin qui fournit le champ role reçoit 403, même sur son propre profil et même si la valeur est inchangée.',
  })
  @ApiParam({
    name: 'id',
    description: "Identifiant UUID de l'utilisateur à modifier",
    schema: { type: 'string', format: 'uuid' },
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    description:
      'Mise à jour partielle : seuls name, email et role sont acceptés. Les champs omis sont conservés. Le nom est nettoyé des espaces aux extrémités et doit rester non vide. Un objet vide ne change rien. Le mot de passe ne peut pas être modifié ici.',
    examples: {
      profil: {
        summary: 'Modifier son profil',
        value: { name: 'Alice Dupont', email: 'alice.dupont@example.com' },
      },
      role: {
        summary: 'Changer un rôle (administrateur uniquement)',
        value: { role: 'admin' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Utilisateur mis à jour, sans mot de passe ni hash',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/User' },
        example: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'alice.dupont@example.com',
          name: 'Alice Dupont',
          role: 'user',
          createdAt: '2026-09-25T10:00:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'UUID invalide, nom vide, email mal formé, rôle inconnu ou champ non autorisé',
    content: {
      'application/json': {
        schema: {
          ...httpErrorSchema,
          properties: {
            ...httpErrorSchema.properties,
            message: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
            },
          },
        },
        examples: {
          payload: {
            summary: 'Email invalide',
            value: {
              statusCode: 400,
              message: ['email: Invalid email address'],
              error: 'Bad Request',
            },
          },
          identifiant: {
            summary: 'Identifiant invalide',
            value: {
              statusCode: 400,
              message: 'Validation failed (uuid is expected)',
              error: 'Bad Request',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token absent, invalide ou expiré, ou utilisateur connecté supprimé',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['statusCode', 'message'],
          properties: {
            statusCode: { type: 'integer' },
            message: { type: 'string' },
          },
        },
        example: { statusCode: 401, message: 'Unauthorized' },
      },
    },
  })
  @ApiForbiddenResponse({
    description: "Un non-admin tente de modifier un autre profil ou d'envoyer un rôle",
    content: {
      'application/json': {
        schema: httpErrorSchema,
        examples: {
          autreProfil: {
            summary: "Modification du profil d'un autre utilisateur",
            value: {
              statusCode: 403,
              message: 'Vous ne pouvez pas modifier ce profil.',
              error: 'Forbidden',
            },
          },
          role: {
            summary: 'Modification de rôle sans droits administrateur',
            value: {
              statusCode: 403,
              message: 'Seul un administrateur peut modifier un rôle.',
              error: 'Forbidden',
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Aucun utilisateur ne correspond à l'UUID fourni",
    content: {
      'application/json': {
        schema: httpErrorSchema,
        example: {
          statusCode: 404,
          message: 'Utilisateur introuvable.',
          error: 'Not Found',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Email déjà utilisé par un autre utilisateur',
    content: {
      'application/json': {
        schema: httpErrorSchema,
        example: {
          statusCode: 409,
          message: 'Cet email est déjà utilisé.',
          error: 'Conflict',
        },
      },
    },
  })
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateUserSchema }) input: UpdateUserInputDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.update(request.user, id, input);
  }
}