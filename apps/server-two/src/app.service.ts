import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

type events = 'purchase';

const VALID_EVENTS: events[] = ['purchase'];

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): any {
    return {
      server: process.env.INSTANCE_ID,
      message: 'Hello from server-two app!',
    };
  }

  getHealth(): { status: string; server: string; timestamp: string } {
    return {
      status: 'ok',
      server: 'server-two',
      timestamp: new Date().toISOString(),
    };
  }

  async postWebhook(body: any, headers: any): Promise<any> {
    if (!headers?.['x-token']) {
      throw new UnauthorizedException({
        success: false,
        error: 'Invalid Request',
        message: 'Unauthorized request',
        timestamp: new Date().toISOString(),
      });
    }

    if (!body?.event) {
      this.logger.warn(`webhook skipped because event is not defined`);
      throw new BadRequestException({
        success: false,
        error: 'Invalid Request',
        message: 'Event is required',
        timestamp: new Date().toISOString(),
      });
    } else if (!VALID_EVENTS.includes(body?.event)) {
      this.logger.warn(
        `webhook skipped because event "${body?.event}" is not in the valid event.`,
      );
      throw new UnprocessableEntityException({
        success: false,
        error: 'Invalid Request',
        message: `Event "${body?.event}" is not in the valid event.`,
        timestamp: new Date().toISOString(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    this.logger.log(`webhook processed successfully`);

    return {
      success: true,
      message: 'Webhook is processed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
