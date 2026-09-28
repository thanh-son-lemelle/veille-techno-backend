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
  UseGuards,
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
  type SchemaObject,
} from '@nestjs/swagger';
import { AuthGuard } from '../../identity/auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../identity/current-user.decorator';
import {
  createCardSchema,
  type CreateCardInputDto,
} from '../dtos/createCardDto.schema';
import {
  updateCardSchema,
  type UpdateCardInputDto,
} from '../dtos/updateCardDto.schema';
import { CardsService } from '../services/cards.service';

const cardSchema: SchemaObject = {
  type: 'object',
  required: [
    'id',
    'title',
    'description',
    'position',
    'listId',
    'createdAt',
    'updatedAt',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    position: {
      type: 'integer',
      format: 'int32',
      minimum: -2147483648,
      maximum: 2147483647,
    },
    listId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const cardExample = {
  id: '6ef227cc-d643-4cb7-82ed-96d99ec7a952',
  title: 'Lire la documentation',
  description: '',
  position: 0,
  listId: '7c3de7b5-a4d3-4e8f-b095-a93c91b407de',
  createdAt: '2026-09-27T10:00:00.000Z',
  updatedAt: '2026-09-27T10:00:00.000Z',
};

const httpErrorSchema: SchemaObject = {
  type: 'object',
  required: ['statusCode', 'message'],
  properties: {
    statusCode: { type: 'integer' },
    message: {
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    error: { type: 'string' },
  },
};

@ApiTags('Cards')
@ApiBearerAuth('bearerAuth')
@ApiBadRequestResponse({
  description:
    'Identifiant UUID invalide ou corps invalide : titre absent à la création, vide ou nul, type incorrect, position hors int32 ou champ non autorisé',
  content: {
    'application/json': {
      schema: httpErrorSchema,
      examples: {
        identifiant: {
          value: {
            statusCode: 400,
            message: 'Validation failed (uuid is expected)',
            error: 'Bad Request',
          },
        },
        corps: {
          value: {
            statusCode: 400,
            message: [
              'title: Too small: expected string to have >=1 characters',
            ],
            error: 'Bad Request',
          },
        },
      },
    },
  },
})
@ApiUnauthorizedResponse({
  description: 'Token absent, invalide ou expiré, ou utilisateur supprimé',
  content: {
    'application/json': {
      schema: httpErrorSchema,
      example: { statusCode: 401, message: 'Unauthorized' },
    },
  },
})
@ApiForbiddenResponse({
  description:
    "La liste parente ou la liste cible appartient à un autre utilisateur. Le rôle administrateur ne dispense pas d'en être propriétaire.",
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
})
@ApiNotFoundResponse({
  description:
    'Carte ou liste introuvable, y compris la liste cible lors d’un déplacement',
  content: {
    'application/json': {
      schema: httpErrorSchema,
      examples: {
        carte: {
          value: {
            statusCode: 404,
            message: 'Carte introuvable.',
            error: 'Not Found',
          },
        },
        liste: {
          value: {
            statusCode: 404,
            message: 'Liste introuvable.',
            error: 'Not Found',
          },
        },
      },
    },
  },
})
@UseGuards(AuthGuard)
@Controller('api')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get('lists/:listId/cards')
  @ApiOperation({
    summary: "Lister les cartes d'une liste",
    description:
      "Réservé au propriétaire de la liste. Les cartes sont triées par position, date de création puis identifiant, dans l'ordre croissant. Une liste vide retourne un tableau vide.",
  })
  @ApiParam({
    name: 'listId',
    description: 'Identifiant UUID de la liste parente',
    schema: { type: 'string', format: 'uuid', example: cardExample.listId },
  })
  @ApiOkResponse({
    description: 'Cartes de la liste',
    content: {
      'application/json': {
        schema: { type: 'array', items: cardSchema },
        examples: {
          cartes: { value: [cardExample] },
          listeVide: { value: [] },
        },
      },
    },
  })
  findAll(
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardsService.findAll(user.id, listId);
  }

  @Post('lists/:listId/cards')
  @ApiOperation({
    summary: 'Créer une carte',
    description:
      'Réservé au propriétaire de la liste. La description vaut une chaîne vide et la position vaut 0 si elles sont omises.',
  })
  @ApiParam({
    name: 'listId',
    description: 'Identifiant UUID de la liste parente',
    schema: { type: 'string', format: 'uuid', example: cardExample.listId },
  })
  @ApiBody({
    description:
      'Titre obligatoire, nettoyé des espaces aux extrémités. Description vide et position 0 par défaut. Aucun autre champ accepté.',
    examples: {
      carte: {
        value: { title: 'Lire la documentation', description: '', position: 0 },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Carte créée dans la liste demandée',
    content: {
      'application/json': { schema: cardSchema, example: cardExample },
    },
  })
  create(
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body({ schema: createCardSchema }) input: CreateCardInputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardsService.create(user.id, listId, input);
  }

  @Get('cards/:id')
  @ApiOperation({
    summary: 'Récupérer une carte',
    description: 'Réservé au propriétaire de la liste parente de la carte.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant UUID de la carte',
    schema: { type: 'string', format: 'uuid', example: cardExample.id },
  })
  @ApiOkResponse({
    description: 'Carte demandée',
    content: {
      'application/json': { schema: cardSchema, example: cardExample },
    },
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardsService.findOne(user.id, id);
  }

  @Patch('cards/:id')
  @ApiOperation({
    summary: 'Modifier une carte (titre, description, position, liste)',
    description:
      'Réservé au propriétaire de la liste actuelle et, en cas de déplacement, de la liste cible. Une cible étrangère retourne 403 ; une carte ou une cible inexistante retourne 404. Les champs omis sont conservés et un objet vide ne modifie pas la carte.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant UUID de la carte',
    schema: { type: 'string', format: 'uuid', example: cardExample.id },
  })
  @ApiBody({
    description:
      'Champs optionnels : title, description, position et listId. Un objet vide conserve la carte. La liste cible doit appartenir au même utilisateur.',
    examples: {
      modification: {
        value: { title: 'Documentation lue', description: '', position: 1 },
      },
      deplacement: {
        value: { listId: '22222222-2222-4222-8222-222222222222' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Carte mise à jour',
    content: {
      'application/json': {
        schema: cardSchema,
        example: {
          ...cardExample,
          title: 'Documentation lue',
          position: 1,
          updatedAt: '2026-09-27T11:00:00.000Z',
        },
      },
    },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateCardSchema }) input: UpdateCardInputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardsService.update(user.id, id, input);
  }

  @Delete('cards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une carte',
    description:
      'Réservé au propriétaire de la liste parente. Retourne 204 sans corps après suppression.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant UUID de la carte',
    schema: { type: 'string', format: 'uuid', example: cardExample.id },
  })
  @ApiNoContentResponse({
    description: 'Carte supprimée, sans corps de réponse',
  })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cardsService.delete(user.id, id);
  }
}
