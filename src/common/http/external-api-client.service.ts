import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper around the external master-data API (locations/sections/poles).
 * Base URL + bearer token are env-driven so they can differ per environment
 * without code changes.
 */
@Injectable()
export class ExternalApiClientService {
  private readonly logger = new Logger(ExternalApiClientService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('EXTERNAL_API_BASE_URL') ||
      'http://43.204.141.252:3013/api/'
    ).replace(/\/+$/, '/');
    this.token =
      this.configService.get<string>('EXTERNAL_API_TOKEN') ||
      'ZDh7rtXw-COFhoipuhLK_NeCLCcGrEwwyXZ6PHl9uNs';
  }

  async post<T = any>(path: string, body: Record<string, any>): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ''), this.baseUrl).toString();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`Failed to reach external API at ${url}`, err);
      throw new HttpException(
        'Unable to reach external API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      this.logger.error(
        `External API ${url} responded with ${response.status}: ${JSON.stringify(data)}`,
      );
      throw new HttpException(
        data?.message || 'External API request failed',
        response.status || HttpStatus.BAD_GATEWAY,
      );
    }

    return data as T;
  }
}
