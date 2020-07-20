import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, example, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { IMessageAttachment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { formatBytes } from '../lib/helpers/bytesConverter';
import { formatDate, timeSince } from '../lib/helpers/dates';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class TransferCompleteWebhookEndpooint extends ApiEndpoint {
    public path = 'transfercomplete';

    @example({
      query: {
          rooms: '@user,room',
      },
    })
    public async post(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponse> {
        if (!request.content) {
          return this.success();
        }

        if (!request.query || !request.query.rooms) {
          console.log('[PutIoApp.TransferCompleteWebhookEndpooint] Rooms not provided', request.query);
          return this.success();
        }

        const rooms = request.query.rooms.split(',');
        await rooms.forEach(async (roomToSend) => {
          roomToSend = roomToSend.trim();

          const payload = request.content;

          const avatarUrl = await read.getEnvironmentReader().getSettings().getValueById('icon');
          const alias = await read.getEnvironmentReader().getSettings().getValueById('name');
          const senderName = await read.getEnvironmentReader().getSettings().getValueById('sender');
          const sender = await read.getUserReader().getById(senderName);

          let room;
          if (roomToSend.startsWith('@')) {
            room = await read.getRoomReader().getDirectByUsernames([senderName, roomToSend.substring(1, roomToSend.length)]);
          } else  {
            room = await read.getRoomReader().getByName(roomToSend);
          }

          let cancelText = 'Cancel';
          if (payload.status === 'SEEDING') {
            cancelText = 'Stop Seeding';
          }
          if (payload.status === 'COMPLETED') {
            cancelText = 'Clear';
          }

          if (room) {
            const attachments = new Array<IMessageAttachment>();
            attachments.push({
              color: '#fdce45',
              title: {
                value: payload.name,
                link: 'https://app.put.io',
              },
              fields: [
                {
                  short: true,
                  title: 'Status',
                  value: payload.status,
                },
                {
                  short: true,
                  title: 'Type',
                  value: payload.type,
                },
                {
                  short: true,
                  title: 'Size',
                  value: formatBytes(payload.size),
                },
                {
                  short: true,
                  title: 'Finished',
                  value: formatDate(payload.finished_at),
                },
                {
                  short: true,
                  title: 'Created',
                  value: `${formatDate(payload.created_at)}\n(${timeSince(payload.created_at)})`,
                },
                {
                  short: true,
                  title: 'Ratio',
                  value: payload.current_ratio,
                },
              ],
              actions: [
                {
                  type: MessageActionType.BUTTON,
                  text: cancelText,
                  msg: `/putio-transfers-cancel ${payload.id}`,
                  msg_in_chat_window: true,
                  msg_processing_type: MessageProcessingType.RespondWithMessage,
                },
              ],
            });

            const message = modify.getCreator().startMessage({
              room,
              sender,
              groupable: false,
              avatarUrl,
              alias,
              text: payload.text,
            }).setAttachments(attachments);

            await modify.getCreator().finish(message);
          } else {
            console.log('[PutIoApp.TransferCompleteWebhookEndpooint] Room could not be determined', roomToSend);
          }
        });

        return this.success();
    }
}
