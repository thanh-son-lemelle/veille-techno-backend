import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { List } from './list.entity';

@Injectable()
export class ListsRepository {
  constructor(
    @InjectRepository(List)
    private readonly repository: Repository<List>,
  ) {}

  findAllByOwnerId(ownerId: string) {
    return this.repository.find({
      where: { ownerId },
      order: { position: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
  }

  findById(id: string) {
    return this.repository.findOneBy({ id });
  }

  createList(input: { title: string; ownerId: string; position?: number }) {
    const list = this.repository.create({
      title: input.title,
      ownerId: input.ownerId,
      position: input.position,
    });

    return this.repository.save(list);
  }

  save(list: List) {
    return this.repository.save(list);
  }

  delete(id: string) {
    return this.repository.delete(id);
  }
}
