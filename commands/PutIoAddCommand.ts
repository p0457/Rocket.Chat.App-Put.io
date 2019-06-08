import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';

export class PutIoAddCommand implements ISlashCommand {
  public command = 'putio-add';
  public i18nParamsExample = 'slashcommand_add_params';
  public i18nDescription = 'slashcommand_add_description';
  public providesPreview = false;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const [magnetLink] = context.getArguments();

    if (!magnetLink) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Magnet link not provided!');
      return;
    }

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    const token = await persistence.getUserToken(context.getSender());
    if (!token) {
      // tslint:disable-next-line:max-line-length
      await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, context.getSender(), context.getRoom());
      return;
    }

    const url = 'https://api.put.io/v2/transfers/add';

    const response = await http.post(url, {
      params: {
        url: magnetLink,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    let responseData;

    if (response.content) {
      responseData = JSON.parse(response.content);
    }

    if (!response) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (response.statusCode === 401) {
      await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom(), persis);
      return;
    }
    if (response.statusCode === 400) {
      if (responseData.error_type && responseData.error_type === 'Alreadyadded') {
        // TODO: when ready, hook up a call to get the item's status
        await msgHelper.sendNotification('Already added this item!', read, modify, context.getSender(), context.getRoom());
        return;
      }
    }
    if (response.statusCode !== 200 || !response.content) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    if (!responseData.transfer) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    await msgHelper.sendSuccessfulTransferAdd(responseData.transfer, read, modify, context.getSender(), context.getRoom(), persis);
    return;
  }
}
