import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { AuthInterceptor } from '../auth/middleware/interceptor.middleware';
import {
  AssetListDto,
  AssetLookupDto,
  CreateAssetDto,
  UpdateAssetDto,
} from '../dto/asset.dto';
import { AssetsService } from './assets.service';

// @UseGuards(AuthGuard)
@UseInterceptors(AuthInterceptor)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @Get()
  findAll(@Query() listDto: AssetListDto) {
    return this.assetsService.findAll(listDto);
  }

  // Accepts either asset_id or barcode in the body - whichever is passed in.
  @Post('lookup')
  findByIdOrBarcode(@Body() lookupDto: AssetLookupDto) {
    return this.assetsService.findByIdOrBarcode(lookupDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(id, updateAssetDto);
  }
}
