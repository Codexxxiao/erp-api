import { PartialType } from '@nestjs/swagger';
import { CreateFormSnapshotDto } from './create-form-snapshot.dto';

export class UpdateFormSnapshotDto extends PartialType(CreateFormSnapshotDto) {}
