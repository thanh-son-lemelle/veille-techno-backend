import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './card.entity';

@Injectable()
export class CardsRepository {
  constructor(
    @InjectRepository(Card)
    private readonly repository: Repository<Card>,
  ) {}

  findAllByListId(listId: string) {
    return this.repository.find({
      where: { listId },
      order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
  }

  findById(id: string) {
    return this.repository.findOneBy({ id });
  }

  createCard(input: {
    title: string;
    description?: string;
    position?: number;
    listId: string;
  }) {
    const card = this.repository.create({
      title: input.title,
      description: input.description,
      position: input.position,
      listId: input.listId,
    });

    return this.repository.save(card);
  }

  save(card: Card) {
    return this.repository.save(card);
  }

  delete(id: string) {
    return this.repository.delete(id);
  }
}
