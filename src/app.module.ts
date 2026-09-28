import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmExceptionFilter } from './common/filters/exception.filter';
import {
  createDatabaseOptions,
  environmentSchema,
} from './database/database.config';
import { IdentityModule } from './identity/identity.module';
import { KanbanModule } from './kanban/kanban.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: environmentSchema,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return Object.assign({}, createDatabaseOptions(config), {
          autoLoadEntities: true,
          retryAttempts: 1,
        });
      },
    }),
    IdentityModule,
    KanbanModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useClass: StandardSchemaValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: TypeOrmExceptionFilter,
    },
  ],
})
export class AppModule {}
