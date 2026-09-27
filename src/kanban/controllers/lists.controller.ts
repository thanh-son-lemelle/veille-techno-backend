import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  StandardSchemaValidationPipe,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  type ApiResponseNoStatusOptions,
  type SchemaObject,
} from '@nestjs/swagger';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../../identity/auth.guard';
import {
  createListSchema,
  type CreateListInputDto,
} from '../dtos/createListDto.schema';
import {
  updateListSchema,
  type UpdateListInputDto,
} from '../dtos/updateListDto.schema';
import { ListsService } from '../services/lists.service';

const listSchema: SchemaObject = {
  type: 'object',
  required: ['id', 'title', 'position', 'ownerId', 'createdAt'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    position: {
      type: 'integer',
      format: 'int32',
      minimum: -2147483648,
      maximum: 2147483647,
    },
    ownerId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const listExample = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'à faire',
  position: 0,
  ownerId: '4f7c8393-20ab-4f85-96ce-b6e115dcb5f3',
  createdAt: '2026-09-27T10:00:00.000Z',
};

const httpErrorSchema: SchemaObject = {
  type: 'object',
  required: ['statusCode', 'message', 'error'],
  properties: {
    statusCode: { type: 'integer' },
    message: { type: 'string' },
    error: { type: 'string' },
  },
};

const badRequestSchema: SchemaObject = {
  ...httpErrorSchema,
  properties: {
    ...httpErrorSchema.properties,
    message: {
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
  },
};

const invalidBodyExample = {
  statusCode: 400,
  message: ['title: Too small: expected string to have >=1 characters'],
  error: 'Bad Request',
};

const invalidIdExample = {
  statusCode: 400,
  message: 'Validation failed (uuid is expected)',
  error: 'Bad Request',
};

const forbiddenResponse: ApiResponseNoStatusOptions = {
  description:
    "La liste appartient à un autre utilisateur, même si l'appelant est administrateur",
  content: {
    'application/json': {
      schema: httpErrorSchema,
      example: {
        statusCode: 403,
        message: 'Vous ne pouvez pas accéder à cette liste.',
        error: 'Forbidden',
      },
    },
  },
};

const notFoundResponse: ApiResponseNoStatusOptions = {
  description: "Aucune liste ne correspond à l'UUID fourni",
  content: {
    'application/json': {
      schema: httpErrorSchema,
      example: {
        statusCode: 404,
        message: 'Liste introuvable.',
        error: 'Not Found',
      },
    },
  },
};

@ApiTags('Lists')
@ApiBearerAuth('bearerAuth')
@ApiUnauthorizedResponse({
  description:
    'Token absent, invalide ou expiré, ou utilisateur connecté supprimé',
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
@UseGuards(AuthGuard)
@UsePipes(StandardSchemaValidationPipe)
@Controller('api/lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  @ApiOperation({
    summary: "Lister les listes de l'utilisateur connecté",
    description:
      'Retourne uniquement les listes du propriétaire connecté, triées par position, date de création puis identifiant. Retourne un tableau vide si aucune liste ne lui appartient.',
  })
  @ApiOkResponse({
    description: "Listes de l'utilisateur connecté",
    content: {
      'application/json': {
        schema: { type: 'array', items: listSchema },
        examples: {
          listes: { value: [listExample] },
          aucuneListe: { value: [] },
        },
      },
    },
  })
  findAll(@Req() request: AuthenticatedRequest) {
    return this.listsService.findAll(request.user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Créer une liste',
    description:
      "Le propriétaire est l'utilisateur connecté. La position vaut 0 si elle est omise.",
  })
  @ApiBody({
    description:
      'Le titre est obligatoire, nettoyé des espaces aux extrémités et doit rester non vide. La position est un entier signé sur 32 bits. Seuls title et position sont acceptés.',
    examples: { liste: { value: { title: 'À faire', position: 0 } } },
  })
  @ApiCreatedResponse({
    description: 'Liste créée avec le propriétaire connecté',
    content: {
      'application/json': { schema: listSchema, example: listExample },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Titre absent, vide ou nul, position non entière ou hors int32, ou champ non autorisé',
    content: {
      'application/json': {
        schema: badRequestSchema,
        example: invalidBodyExample,
      },
    },
  })
  create(
    @Body({ schema: createListSchema }) input: CreateListInputDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.listsService.create(request.user.id, input);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une liste (titre, position)',
    description:
      "Réservé au propriétaire de la liste, sans exception pour les administrateurs. Une liste absente retourne 404 ; celle d'un autre utilisateur retourne 403.",
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant UUID de la liste',
    schema: { type: 'string', format: 'uuid' },
    example: listExample.id,
  })
  @ApiBody({
    description:
      'Mise à jour partielle : seuls title et position sont acceptés. Le titre est nettoyé et doit rester non vide. La position est un entier signé sur 32 bits. Les champs omis sont conservés ; un objet vide ne change rien.',
    examples: { liste: { value: { title: 'En cours', position: 1 } } },
  })
  @ApiOkResponse({
    description: 'Liste mise à jour',
    content: {
      'application/json': {
        schema: listSchema,
        example: { ...listExample, title: 'En cours', position: 1 },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'UUID invalide, titre vide ou nul, position non entière ou hors int32, ou champ non autorisé',
    content: {
      'application/json': {
        schema: badRequestSchema,
        examples: {
          corps: { value: invalidBodyExample },
          identifiant: { value: invalidIdExample },
        },
      },
    },
  })
  @ApiForbiddenResponse(forbiddenResponse)
  @ApiNotFoundResponse(notFoundResponse)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateListSchema }) input: UpdateListInputDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.listsService.update(request.user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une liste',
    description:
      'Réservé au propriétaire de la liste, sans exception pour les administrateurs. Retourne 204 sans corps après suppression, 404 si la liste est absente ou 403 si elle appartient à un autre utilisateur.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant UUID de la liste',
    schema: { type: 'string', format: 'uuid' },
    example: listExample.id,
  })
  @ApiNoContentResponse({
    description: 'Liste supprimée, sans corps de réponse',
  })
  @ApiBadRequestResponse({
    description: 'Identifiant UUID de liste invalide',
    content: {
      'application/json': {
        schema: httpErrorSchema,
        example: invalidIdExample,
      },
    },
  })
  @ApiForbiddenResponse(forbiddenResponse)
  @ApiNotFoundResponse(notFoundResponse)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.listsService.delete(request.user.id, id);
  }
}
