import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageLevel,
  MessageRecipientStatus,
  MessageType,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { SendTemplateMessageDto } from './dto/send-template-message.dto';

type MessageTarget = {
  tenantId: string;
  userIds?: string[];
  roleIds?: string[];
  toAll?: boolean;
};

type SystemMessageInput = MessageTarget & {
  title: string;
  content: string;
  type?: MessageType;
  level?: MessageLevel;
  sourceType?: string;
  sourceId?: string;
  linkType?: string;
  linkId?: string;
  linkUrl?: string;
  payload?: unknown;
  createdById?: string;
};

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async send(user: CurrentUser, dto: SendMessageDto) {
    const tenantId = requireTenantId(user);
    const recipientIds = await this.resolveRecipientUserIds({
      tenantId,
      userIds: dto.userIds,
      roleIds: dto.roleIds,
      toAll: dto.toAll,
    });

    return this.prisma.$transaction((tx) =>
      this.createMessageWithRecipients(tx, {
        tenantId,
        title: dto.title,
        content: dto.content,
        type: dto.type ?? MessageType.SYSTEM,
        level: dto.level ?? MessageLevel.INFO,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        linkType: dto.linkType,
        linkId: dto.linkId,
        linkUrl: dto.linkUrl,
        payload: dto.payload,
        createdById: user.id,
        recipientIds,
      }),
    );
  }

  async sendSystem(input: SystemMessageInput, tx?: Prisma.TransactionClient) {
    const recipientIds = await this.resolveRecipientUserIds({
      tenantId: input.tenantId,
      userIds: input.userIds,
      roleIds: input.roleIds,
      toAll: input.toAll,
    });

    const client = tx ?? this.prisma;

    return this.createMessageWithRecipients(client, {
      tenantId: input.tenantId,
      title: input.title,
      content: input.content,
      type: input.type ?? MessageType.SYSTEM,
      level: input.level ?? MessageLevel.INFO,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      linkType: input.linkType,
      linkId: input.linkId,
      linkUrl: input.linkUrl,
      payload: input.payload,
      createdById: input.createdById,
      recipientIds,
    });
  }

  async findMine(user: CurrentUser, query: QueryMessageDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.MessageRecipientWhereInput = {
      tenantId,
      userId: user.id,
      status: query.status ?? {
        not: MessageRecipientStatus.ARCHIVED,
      },
      message: {
        type: query.type,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.messageRecipient.count({ where }),
      this.prisma.messageRecipient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { message: true },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const recipient = await this.prisma.messageRecipient.findFirst({
      where: {
        id,
        tenantId,
        userId: user.id,
      },
      include: { message: true },
    });

    if (!recipient) throw new NotFoundException('消息不存在');
    return recipient;
  }

  async unreadCount(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    const count = await this.prisma.messageRecipient.count({
      where: {
        tenantId,
        userId: user.id,
        status: MessageRecipientStatus.UNREAD,
        message: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      },
    });

    return { count };
  }

  async markRead(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const recipient = await this.prisma.messageRecipient.findFirst({
      where: { id, tenantId, userId: user.id },
    });

    if (!recipient) throw new NotFoundException('消息不存在');

    if (recipient.status === MessageRecipientStatus.ARCHIVED) {
      return recipient;
    }

    return this.prisma.messageRecipient.update({
      where: { id },
      data: {
        status: MessageRecipientStatus.READ,
        readAt: recipient.readAt ?? new Date(),
      },
      include: { message: true },
    });
  }

  async markAllRead(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    const result = await this.prisma.messageRecipient.updateMany({
      where: {
        tenantId,
        userId: user.id,
        status: MessageRecipientStatus.UNREAD,
      },
      data: {
        status: MessageRecipientStatus.READ,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  async archive(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const recipient = await this.prisma.messageRecipient.findFirst({
      where: { id, tenantId, userId: user.id },
    });

    if (!recipient) throw new NotFoundException('消息不存在');

    return this.prisma.messageRecipient.update({
      where: { id },
      data: {
        status: MessageRecipientStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: { message: true },
    });
  }

  async createTemplate(user: CurrentUser, dto: CreateMessageTemplateDto) {
    const tenantId = requireTenantId(user);

    return this.prisma.messageTemplate.create({
      data: {
        tenantId,
        scopeKey: `tenant:${tenantId}`,
        code: dto.code,
        name: dto.name,
        type: dto.type ?? MessageType.SYSTEM,
        level: dto.level ?? MessageLevel.INFO,
        titleTemplate: dto.titleTemplate,
        contentTemplate: dto.contentTemplate,
        config: dto.config as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findTemplates(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    return this.prisma.messageTemplate.findMany({
      where: {
        OR: [{ scopeKey: 'system', isActive: true }, { tenantId }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTemplate(
    user: CurrentUser,
    id: string,
    dto: UpdateMessageTemplateDto,
  ) {
    const tenantId = requireTenantId(user);

    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) throw new NotFoundException('消息模板不存在');

    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        level: dto.level,
        titleTemplate: dto.titleTemplate,
        contentTemplate: dto.contentTemplate,
        config: dto.config as Prisma.InputJsonValue,
        isActive: dto.isActive,
      },
    });
  }

  async sendByTemplate(user: CurrentUser, dto: SendTemplateMessageDto) {
    const tenantId = requireTenantId(user);

    const template = await this.prisma.messageTemplate.findFirst({
      where: {
        code: dto.templateCode,
        isActive: true,
        OR: [{ scopeKey: 'system' }, { tenantId }],
      },
      orderBy: { tenantId: 'desc' },
    });

    if (!template) throw new NotFoundException('消息模板不存在');

    const variables = dto.variables ?? {};

    return this.send(user, {
      title: this.render(template.titleTemplate, variables),
      content: this.render(template.contentTemplate, variables),
      type: template.type,
      level: template.level,
      userIds: dto.userIds,
      roleIds: dto.roleIds,
      toAll: dto.toAll,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      linkType: dto.linkType,
      linkId: dto.linkId,
      linkUrl: dto.linkUrl,
      payload: dto.payload,
    });
  }

  private async createMessageWithRecipients(
    tx: Prisma.TransactionClient | PrismaService,
    input: {
      tenantId: string;
      title: string;
      content: string;
      type: MessageType;
      level: MessageLevel;
      sourceType?: string;
      sourceId?: string;
      linkType?: string;
      linkId?: string;
      linkUrl?: string;
      payload?: unknown;
      createdById?: string;
      recipientIds: string[];
    },
  ) {
    if (input.recipientIds.length === 0) {
      throw new BadRequestException('消息至少需要一个接收人');
    }

    const message = await tx.message.create({
      data: {
        tenantId: input.tenantId,
        title: input.title,
        content: input.content,
        type: input.type,
        level: input.level,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        linkType: input.linkType,
        linkId: input.linkId,
        linkUrl: input.linkUrl,
        payload: input.payload as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });

    await tx.messageRecipient.createMany({
      data: input.recipientIds.map((userId) => ({
        tenantId: input.tenantId,
        messageId: message.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return tx.message.findUnique({
      where: { id: message.id },
      include: { recipients: true },
    });
  }

  private async resolveRecipientUserIds(target: MessageTarget) {
    const ids = new Set<string>();

    if (target.userIds?.length) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: target.tenantId,
          id: { in: target.userIds },
          isActive: true,
        },
        select: { id: true },
      });

      users.forEach((user) => ids.add(user.id));
    }

    if (target.roleIds?.length) {
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          roleId: { in: target.roleIds },
          role: {
            tenantId: target.tenantId,
            isActive: true,
          },
          user: {
            tenantId: target.tenantId,
            isActive: true,
          },
        },
        include: { user: true },
      });

      userRoles.forEach((item) => ids.add(item.user.id));
    }

    if (target.toAll) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: target.tenantId,
          isActive: true,
        },
        select: { id: true },
      });

      users.forEach((user) => ids.add(user.id));
    }

    return Array.from(ids);
  }

  private render(template: string, variables: Record<string, unknown>) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = variables[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }
}
