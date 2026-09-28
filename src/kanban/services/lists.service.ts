import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateListInputDto } from '../dtos/createListDto.schema';
import type { UpdateListInputDto } from '../dtos/updateListDto.schema';
import { ListsRepository } from '../lists.repository';

@Injectable()
export class ListsService {
  constructor(private readonly listsRepository: ListsRepository) {}

  findAll(ownerId: string) {
    return this.listsRepository.findAllByOwnerId(ownerId);
  }

  create(ownerId: string, input: CreateListInputDto) {
    return this.listsRepository.createList({
      title: input.title,
      position: input.position,
      ownerId,
    });
  }

  async update(ownerId: string, id: string, input: UpdateListInputDto) {
    const list = await this.findOwnedList(ownerId, id);

    if (input.title !== undefined) {
      list.title = input.title;
    }

    if (input.position !== undefined) {
      list.position = input.position;
    }

    return this.listsRepository.save(list);
  }

  async delete(ownerId: string, id: string): Promise<void> {
    await this.findOwnedList(ownerId, id);
    await this.listsRepository.delete(id);
  }

  async findOwnedList(ownerId: string, id: string) {
    const list = await this.listsRepository.findById(id);

    if (!list) {
      throw new NotFoundException('Liste introuvable.');
    }

    if (list.ownerId !== ownerId) {
      throw new ForbiddenException('Vous ne pouvez pas accéder à cette liste.');
    }

    return list;
  }
}
