import { Module } from '@nestjs/common';
import { RuntimeFormModule } from '../runtime-form/runtime-form.module';
import { DocumentFlowController } from './document-flow.controller';
import { DocumentFlowService } from './document-flow.service';

@Module({
  imports: [RuntimeFormModule],
  controllers: [DocumentFlowController],
  providers: [DocumentFlowService],
  exports: [DocumentFlowService],
})
export class DocumentFlowModule {}
