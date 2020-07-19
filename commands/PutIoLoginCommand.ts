import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';

export class PutIoLoginCommand implements ISlashCommand {
  public command = 'putio-login';
  public i18nParamsExample = 'slashcommand_login_params';
  public i18nDescription = 'slashcommand_login_description';
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
    const clientId = await read.getEnvironmentReader().getSettings().getValueById('clientid');
    const clientSecret = await read.getEnvironmentReader().getSettings().getValueById('clientsecret');
    let rootUrl = await read.getEnvironmentReader().getEnvironmentVariables().getValueByName('ROOT_URL');
    if (rootUrl.endsWith('/')) {
      rootUrl = rootUrl.substring(0, rootUrl.length - 1); // remove last '/'
    }

    const newUuid = uuidv4();

    // tslint:disable-next-line:max-line-length
    const url = `https://app.put.io/v2/oauth2/authenticate?client_id=${clientId}&response_type=token&state=${newUuid}&redirect_uri=${rootUrl}${this.endpoint}`;

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    let currentAuthAttempts = await persistence.getAuthAttempts();
    if (!currentAuthAttempts) {
      currentAuthAttempts = new Array();
    }
    const userAuthAttemptIdx = currentAuthAttempts.findIndex((authAttempt) => {
      return authAttempt.userName === context.getSender().username;
    });
    if (userAuthAttemptIdx && userAuthAttemptIdx >= 0) {
      currentAuthAttempts[userAuthAttemptIdx] = {
        userName: context.getSender().username,
        room: context.getRoom(),
        authId: newUuid,
      };
    } else {
      currentAuthAttempts.push({
        userName: context.getSender().username,
        room: context.getRoom(),
        authId: newUuid,
      });
    }
    await persistence.setAuthAttempts(currentAuthAttempts);

    const attachment = {
      collapsed: false,
      actions: [
        {
          type: MessageActionType.BUTTON,
          url,
          text: 'Login',
          msg_in_chat_window: false,
          msg_processing_type: MessageProcessingType.SendMessage,
        },
      ],
      text: 'You will now need to open a browser to initiate an OAuth authorization. Due to ridiculous design ' +
        'decision by the folks at Put.io, you will need to manually copy the token. Instructions will follow after ' +
        'the authorization has completed.',
    };
    await msgHelper.sendNotificationMultipleAttachments([attachment], read, modify, context.getSender(), context.getRoom());
  }
}
