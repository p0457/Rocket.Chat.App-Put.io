import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { formatBytes } from '../lib/helpers/bytesConverter';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class WebhookEndpoint extends ApiEndpoint {
    public path = 'webhook';

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

        const payload = request.content;

        const avatarUrl = await read.getEnvironmentReader().getSettings().getValueById('putio_icon');
        const alias = await read.getEnvironmentReader().getSettings().getValueById('putio_name');
        const sendTo = await read.getEnvironmentReader().getSettings().getValueById('putio_postto');
        const sender = await read.getUserReader().getById('rocket.cat');

        let room;
        if (sendTo.startsWith('@')) {
          room = await read.getRoomReader().getDirectByUsernames(['rocket.cat', sendTo.substring(1, sendTo.length)]);
        } else if (sendTo.startsWith('#')) {
          room = await read.getRoomReader().getByName(sendTo.substring(1, sendTo.length));
        }

        if (!room) {
          return this.success();
        }

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

        return this.success();
    }
}
