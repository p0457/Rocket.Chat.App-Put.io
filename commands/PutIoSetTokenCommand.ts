import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';

export class PutIoSetTokenCommand implements ISlashCommand {
  public command = 'putio-set-token';
  public i18nParamsExample = 'slashcommand_settoken_params';
  public i18nDescription = 'slashcommand_settoken_description';
  public providesPreview = false;

  public endpoint = '';

  public constructor(private readonly app: PutIoApp) {
    try {
      const accessors = app.getAccessors();
      const endpoints = accessors.providedApiEndpoints;
      if (endpoints) {
        const endpoint = endpoints.find((appEndpoint) => {
          return appEndpoint.path === 'oauth-callback';
        });
        if (endpoint) {
          this.endpoint = endpoint.computedPath;
        }
      }
    } catch (e) {
      console.log('Failed to find oauth-callback endpoint entry!', e);
    }
  }

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const [token] = context.getArguments();

    if (!token) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Token not provided!');
      return;
    }

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    await persistence.setUserToken(token, context.getSender());

    const accountInfoUrl = 'https://api.put.io/v2/account/info';
    const accountInfoResponse = await http.get(accountInfoUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!accountInfoResponse || accountInfoResponse.statusCode === 401 || !accountInfoResponse.content) {
      await msgHelper.sendNotification('Failed to get account info! Token may not be valid.', read, modify, context.getSender(), context.getRoom());
      return;
    }

    const accountInfo = JSON.parse(accountInfoResponse.content);
    if (!accountInfo.info) {
      await msgHelper.sendNotification('Failed to parse results!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    await persistence.setUserAvatarUrl(accountInfo.info.avatar_url, context.getSender());

    await msgHelper.sendNotificationMultipleAttachments([
      {
        collapsed: false,
        color: '#00CE00',
        title: {
          value: 'Token saved!',
        },
      },
    ], read, modify, context.getSender(), context.getRoom());

    await msgHelper.sendAccountInfo(accountInfo.info, read, modify, context.getSender(), context.getRoom());

    // Remove the auth attempt from persistence
    let currentAuthAttempts = await persistence.getAuthAttempts();
    if (currentAuthAttempts) {
      currentAuthAttempts = currentAuthAttempts.filter((authAttempt) => {
        return authAttempt.userName !== context.getSender().username;
      });
      await persistence.setAuthAttempts(currentAuthAttempts);
    }
    return;
  }
}
