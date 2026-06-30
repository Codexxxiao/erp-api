import { PartialType } from '@nestjs/swagger';
import { CreatePackageInstallDto } from './create-package-install.dto';

export class UpdatePackageInstallDto extends PartialType(CreatePackageInstallDto) {}
