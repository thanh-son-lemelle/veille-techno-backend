import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { Card } from './card.entity';
import { CardsRepository } from './cards.repository';
import { CardsController } from './controllers/cards.controller';
import { ListsController } from './controllers/lists.controller';
import { List } from './list.entity';
import { ListsRepository } from './lists.repository';
import { CardsService } from './services/cards.service';
import { ListsService } from './services/lists.service';

@Module({
  imports: [IdentityModule, TypeOrmModule.forFeature([List, Card])],
  controllers: [ListsController, CardsController],
  providers: [ListsRepository, CardsRepository, ListsService, CardsService],
  exports: [ListsRepository],
})
export class KanbanModule {}
