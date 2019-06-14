import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';

export class PutIoRSSPauseCommand implements ISlashCommand {
  public command = 'putio-rss-pause';
  public i18nParamsExample = 'slashcommand_rsspause_params';
  public i18nDescription = 'slashcommand_rsspause_description';
  public providesPreview = false;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const [feedId] = context.getArguments();

    if (!feedId) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Feed Id not provided!');
      return;
    }

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    const token = await persistence.getUserToken(context.getSender());
    if (!token) {
      // tslint:disable-next-line:max-line-length
      await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, context.getSender(), context.getRoom());
      return;
    }

    const url = `https://api.put.io/v2/rss/${feedId}/pause`;

    const response = await http.post(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (response.statusCode === 401) {
      await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom(), persis);
      return;
    }
    if (response.statusCode !== 200) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    await msgHelper.sendNotification('Successfully Paused RSS Feed!', read, modify, context.getSender(), context.getRoom());
    return;
  }
}
