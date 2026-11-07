import { Injectable } from '@nestjs/common';
import { ExternalApiClientService } from '../common/http/external-api-client.service';
import {
  LocationsListQueryDto,
  PolesListQueryDto,
  QrCodeLookupDto,
  SectionsListQueryDto,
} from '../dto/master-details.dto';

@Injectable()
export class MasterDetailsService {
  constructor(private readonly externalApiClient: ExternalApiClientService) {}

  async getLocations(query: LocationsListQueryDto) {
    return this.externalApiClient.post('masterdetails/locations', {
      searchText: query.searchText ?? '',
      page: query.page,
      limit: query.limit,
    });
  }

  async getSections(query: SectionsListQueryDto) {
    return this.externalApiClient.post('masterdetails/sections', {
      searchText: query.searchText ?? '',
      page: query.page,
      limit: query.limit,
      ...(query.locationId !== undefined
        ? { locationId: query.locationId }
        : {}),
    });
  }

  async getPoles(query: PolesListQueryDto) {
    return this.externalApiClient.post('masterdetails/poles', {
      searchText: query.searchText ?? '',
      page: query.page,
      limit: query.limit,
      ...(query.sectionId !== undefined ? { sectionId: query.sectionId } : {}),
    });
  }

  async getQrCode(query: QrCodeLookupDto) {
    return this.externalApiClient.post('masterdetails/qrcode', {
      qrcode: query.qrcode,
    });
  }
}
