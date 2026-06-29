import { PartialType } from '@nestjs/swagger';
import { CreateDocumentFlowDto } from './create-document-flow.dto';

export class UpdateDocumentFlowDto extends PartialType(CreateDocumentFlowDto) {}
