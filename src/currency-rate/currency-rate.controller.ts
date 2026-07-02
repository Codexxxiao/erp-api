import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { CurrencyRateService } from './currency-rate.service';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { UpdateCurrencyRateDto } from './dto/update-currency-rate.dto';
import { QueryCurrencyRateDto } from './dto/query-currency-rate.dto';
import { ResolveCurrencyRateDto } from './dto/resolve-currency-rate.dto';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { BulkUpsertCurrencyRateDto } from './dto/bulk-upsert-currency-rate.dto';

@ApiTags('CurrencyRate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/currency-rates')
export class CurrencyRateController {
  constructor(private readonly currencyRateService: CurrencyRateService) {}

  @Post()
  @ApiOperation({ summary: '新增汇率' })
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateCurrencyRateDto,
  ) {
    return this.currencyRateService.create(user, dto);
  }

  @Post('bulk-upsert')
  @ApiOperation({ summary: '批量新增或更新汇率' })
  bulkUpsert(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: BulkUpsertCurrencyRateDto,
  ) {
    return this.currencyRateService.bulkUpsert(user, dto);
  }

  @Get()
  @ApiOperation({ summary: '分页查询汇率' })
  findMany(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: QueryCurrencyRateDto,
  ) {
    return this.currencyRateService.findMany(user, query);
  }

  @Get('resolve')
  @ApiOperation({ summary: '解析指定日期可用汇率' })
  resolve(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: ResolveCurrencyRateDto,
  ) {
    return this.currencyRateService.resolveRateByTenant({
      tenantId: requireTenantId(user),
      ...query,
    });
  }

  @Post('convert')
  @ApiOperation({ summary: '金额币种换算' })
  convert(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: ConvertCurrencyDto,
  ) {
    return this.currencyRateService.convertAmountByTenant({
      tenantId: requireTenantId(user),
      ...dto,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '查询汇率详情' })
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.currencyRateService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新汇率' })
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateCurrencyRateDto,
  ) {
    return this.currencyRateService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '停用汇率' })
  remove(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.currencyRateService.remove(user, id);
  }
}
