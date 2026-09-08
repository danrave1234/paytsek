import { Global, Module } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { ReconcileService } from './reconcile.service';

@Global()
@Module({
  providers: [JobsService, ReconcileService],
  exports: [JobsService, ReconcileService],
})
export class MatchingModule {}
