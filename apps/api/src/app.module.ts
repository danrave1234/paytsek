import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.controller';
import { DbModule } from './db/db.module';
import { IngestionModule } from './ingestion/ingestion.controller';
import { CronController } from './jobs/cron.controller';
import { WorkerService } from './jobs/worker.service';
import { MatchingModule } from './matching/matching.module';
import { OperationsModule } from './operations/operations.controller';
import { PairingModule } from './pairing/pairing.controller';
import { RecordsModule } from './records/records.controller';
import { ReviewModule } from './review/review.controller';
import { SourcesModule } from './sources/sources.controller';
import { WorkspacesModule } from './workspaces/workspaces.controller';

@Module({
  imports: [
    DbModule,
    AuthModule,
    MatchingModule,
    WorkspacesModule,
    SourcesModule,
    PairingModule,
    IngestionModule,
    RecordsModule,
    ReviewModule,
    BillingModule,
    OperationsModule,
  ],
  controllers: [CronController],
  providers: [WorkerService],
})
export class AppModule {}
