import { Injectable, NotFoundException } from '@nestjs/common';
import { CardsRepository } from '../cards.repository';
import type { CreateCardInputDto } from '../dtos/createCardDto.schema';
import type { UpdateCardInputDto } from '../dtos/updateCardDto.schema';
import { ListsService } from './lists.service';

@Injectable()
export class CardsService {
  constructor(
    private readonly cardsRepository: CardsRepository,
    private readonly listsService: ListsService,
  ) {}

  async findAll(ownerId: string, listId: string) {
    await this.listsService.findOwnedList(ownerId, listId);
    return this.cardsRepository.findAllByListId(listId);
  }

  async create(ownerId: string, listId: string, input: CreateCardInputDto) {
    await this.listsService.findOwnedList(ownerId, listId);
    return this.cardsRepository.createCard({ ...input, listId });
  }

  async findOne(ownerId: string, id: string) {
    const card = await this.cardsRepository.findById(id);

    if (!card) {
      throw new NotFoundException('Carte introuvable.');
    }

    await this.listsService.findOwnedList(ownerId, card.listId);
    return card;
  }

  async update(ownerId: string, id: string, input: UpdateCardInputDto) {
    const card = await this.findOne(ownerId, id);

    if (input.listId !== undefined) {
      await this.listsService.findOwnedList(ownerId, input.listId);
    }

    if (input.title !== undefined) {
      card.title = input.title;
    }
    if (input.description !== undefined) {
      card.description = input.description;
    }
    if (input.position !== undefined) {
      card.position = input.position;
    }
    if (input.listId !== undefined) {
      card.listId = input.listId;
    }

    return this.cardsRepository.save(card);
  }

  async delete(ownerId: string, id: string): Promise<void> {
    await this.findOne(ownerId, id);
    await this.cardsRepository.delete(id);
  }
}
