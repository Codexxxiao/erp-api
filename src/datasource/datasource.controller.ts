import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DatasourceService } from './datasource.service';
import { CreateDatasourceDto } from './dto/create-datasource.dto';
import { UpdateDatasourceDto } from './dto/update-datasource.dto';

@Controller('datasource')
export class DatasourceController {
  constructor(private readonly datasourceService: DatasourceService) {}

  @Post()
  create(@Body() createDatasourceDto: CreateDatasourceDto) {
    return this.datasourceService.create(createDatasourceDto);
  }

  @Get()
  findAll() {
    return this.datasourceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.datasourceService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDatasourceDto: UpdateDatasourceDto) {
    return this.datasourceService.update(+id, updateDatasourceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.datasourceService.remove(+id);
  }
}
