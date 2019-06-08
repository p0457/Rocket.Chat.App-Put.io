import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, example, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { formatBytes } from '../lib/helpers/bytesConverter';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class TransferCompleteWebhookEndpooint extends ApiEndpoint {
    public path = 'transfercomplete';

    @example({
      query: {
          rooms: '@user,#room',
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

          const avatarUrl = await read.getEnvironmentReader().getSettings().getValueById('putio_icon');
          const alias = await read.getEnvironmentReader().getSettings().getValueById('putio_name');
          const sender = await read.getUserReader().getById('rocket.cat');

          let room;
          if (roomToSend.startsWith('@')) {
            room = await read.getRoomReader().getDirectByUsernames(['rocket.cat', roomToSend.substring(1, roomToSend.length)]);
          } else if (roomToSend.startsWith('#')) {
            room = await read.getRoomReader().getByName(roomToSend.substring(1, roomToSend.length));
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
                  value: payload.finished_at,
                },
                {
                  short: true,
                  title: 'Created',
                  value: payload.created_at,
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
