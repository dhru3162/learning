import { BadRequestException, Injectable, Logger } from '@nestjs/common';

type events = 'purchase';

type db = {
  id: string;
  uri: string;
  token: string;
  event: events;
  registeredAt: string;
};

const db: db[] = [];

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    return 'Hello from server-one!';
  }

  getHealth(): { status: string; server: string; timestamp: string } {
    return {
      status: 'ok',
      server: 'server-one',
      timestamp: new Date().toISOString(),
    };
  }

  async registerWebhook(body: any): Promise<{ message: string }> {
    db.push({
      id: crypto.randomUUID(),
      ...body,
      registeredAt: new Date().toISOString(),
    });

    this.logger.log(`${db?.length} registered webhooks found`);

    return {
      message: 'Webhook registered successfully',
    };
  }

  async purchase(
    body: any,
  ): Promise<{ success: boolean; error?: string; message: string }> {
    const { name = '', email = '', course = '' } = body ?? {};

    if (!name) {
      throw new BadRequestException({
        success: false,
        error: 'Invalid Request',
        message: 'Name is required',
      });
    }
    if (!email) {
      throw new BadRequestException({
        success: false,
        error: 'Invalid Request',
        message: 'Email is required',
      });
    }
    if (!course) {
      throw new BadRequestException({
        success: false,
        error: 'Invalid Request',
        message: 'Course name is required',
      });
    }

    const payload = {
      id: crypto.randomUUID(),
      ...body.data,
    };

    await this.sendWebhook('purchase', payload);

    return {
      success: true,
      message: `Purchase of ${course} successfully`,
    };
  }

  async sendWebhook(event: string, payload: any) {
    if (!event) return;
    const webhooks = db.filter((data) => data.event === event);

    if (webhooks?.length === 0) {
      this.logger.warn(`No webhooks found for event "${event}"`);
    } else if (webhooks?.length > 0) {
      await Promise.allSettled(
        webhooks.map(async (hook) => {
          try {
            const response = await fetch(hook.uri, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-token': hook.token,
              },
              body: JSON.stringify({
                event,
                data: payload,
              }),
            });

            if (response.ok) {
              this.logger.log(
                `Webhook ${hook.id} (${hook.uri}) responded with status ${response.status}`,
              );
            } else {
              this.logger.error(
                `Webhook ${hook.id} (${hook.uri}) responded with status ${response.status}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Webhook ${hook.id} (${hook.uri}) failed`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }),
      );
    }
  }
}
