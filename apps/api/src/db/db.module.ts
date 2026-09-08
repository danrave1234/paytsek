import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DbService } from './db.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [DbService, StorageService, AuditService],
  exports: [DbService, StorageService, AuditService],
})
export class DbModule {}
