import { Controller, Post } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions';

@Controller('outbox')
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  @Post('retry-dead')
  @RequirePermissions(PERMISSIONS.systemManage)
  async retryDeadEvents() {
    const count = await this.outboxService.retryDeadEvents();
    return { success: true, retried: count };
  }
}
