import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';
import { login } from '../lib/helpers/login';

export class PutIoSetTokenCommand implements ISlashCommand {
  public command = 'putio-set-token';
  public i18nParamsExample = 'slashcommand_settoken_params';
  public i18nDescription = 'slashcommand_settoken_description';
  public providesPreview = false;

  public endpoint = '';

  public constructor(private readonly app: PutIoApp) {
    try {
      const accessors = app.getAccessors();
      if (accessors) {
        const endpoints = accessors.providedApiEndpoints;
        if (endpoints) {
          const endpoint = endpoints.find((appEndpoint) => {
            return appEndpoint.path === 'oauth-callback';
          });
          if (endpoint) {
            this.endpoint = endpoint.computedPath;
          }
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

    await login(http, token, persis, read, modify, context.getSender(), context.getRoom());

    return;
  }
}
