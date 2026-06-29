@Post()
create(@CurrentUserDecorator() user: CurrentUser, @Body() dto: CreateFormRecordDto) {
  return this.runtimeFormService.create(user, dto);
}

@Get()
findAll(@CurrentUserDecorator() user: CurrentUser, @Query() query: QueryFormRecordDto) {
  return this.runtimeFormService.findAll(user, query);
}

@Get(':id')
findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
  return this.runtimeFormService.findOne(user, id);
}

@Patch(':id')
update(
  @CurrentUserDecorator() user: CurrentUser,
  @Param('id') id: string,
  @Body() dto: UpdateFormRecordDto,
) {
  return this.runtimeFormService.update(user, id, dto);
}