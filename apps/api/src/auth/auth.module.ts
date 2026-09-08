import { Global, Module } from '@nestjs/common';
import { CollectorAuthGuard, RolesGuard, UserAuthGuard, WorkspaceGuard } from './guards';

@Global()
@Module({
  providers: [UserAuthGuard, WorkspaceGuard, RolesGuard, CollectorAuthGuard],
  exports: [UserAuthGuard, WorkspaceGuard, RolesGuard, CollectorAuthGuard],
})
export class AuthModule {}
