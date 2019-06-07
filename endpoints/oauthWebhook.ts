import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { IMessageAttachment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { formatBytes } from '../lib/helpers/bytesConverter';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';

export class OAuthWebhookEndpooint extends ApiEndpoint {
    public path = 'oauth-callback';

    public async get(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponse> {
        if (request.query && request.query.state) {
          const persistence = new AppPersistence(persis, read.getPersistenceReader());
          let currentAuthAttempts = await persistence.getAuthAttempts();
          if (!currentAuthAttempts) {
            currentAuthAttempts = new Array();
          }
          const userAuthAttempt = currentAuthAttempts.find((authAttempt) => {
            return authAttempt.authId === request.query.state;
          });
          if (userAuthAttempt) {
            const user = await read.getUserReader().getByUsername(userAuthAttempt.userName);
            const room = userAuthAttempt.room;
            await msgHelper.sendNotificationMultipleAttachments([
              {
                collapsed: false,
                color: '#fdcd44',
                title: {
                  value: 'Action needed',
                },
                // tslint:disable-next-line:max-line-length
                text: 'Due to a shortcoming in the Rocket.Chat App engine API, this app cannot access the access token since it is provided as `#access_token=XXXX`\n'
                  + 'You will need to copy this token and use in in a command `/putio-set-token [TOKEN]`\n'
                  + 'Copy this value (after the "#access_token=") and use in the actioned command provided.',
                actions: [
                  {
                    type: MessageActionType.BUTTON,
                    text: 'Set Token',
                    msg: '/putio-set-token PUT_TOKEN_HERE',
                    msg_in_chat_window: true,
                    msg_processing_type: MessageProcessingType.RespondWithMessage,
                  },
                ],
              },
            ], read, modify, user, room);
          }
        }
        return this.success();
    }
}
