import { PartialType } from '@nestjs/swagger';
import { CreateListViewDto } from './create-list-view.dto';

export class UpdateListViewDto extends PartialType(CreateListViewDto) {}
