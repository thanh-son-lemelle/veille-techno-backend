import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { List } from './list.entity';
import { ListsRepository } from './lists.repository';

@Module({
  imports: [TypeOrmModule.forFeature([List])],
  providers: [ListsRepository],
  exports: [ListsRepository],
})
export class KanbanModule {}
