import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';

export class PutIoEventsListCommand implements ISlashCommand {
  public command = 'putio-events-list';
  public i18nParamsExample = 'slashcommand_eventslist_params';
  public i18nDescription = 'slashcommand_eventslist_description';
  public providesPreview = false;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const [pageArg] = context.getArguments();

    const command = `/${this.command}`;

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    const token = await persistence.getUserToken(context.getSender());
    if (!token) {
      // tslint:disable-next-line:max-line-length
      await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, context.getSender(), context.getRoom());
      return;
    }

    let page = 1;
    if (pageArg) {
      const pageSplit = pageArg.split('=');
      if (pageSplit && pageSplit.length > 1) {
        const tempPage = Number(pageSplit[1]);
        if (!isNaN(tempPage)) {
          page = tempPage;
        }
      }
    }

    const url = 'https://api.put.io/v2/events/list';

    const response = await http.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
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
    if (response.statusCode !== 200 || !response.content) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    if (!responseData.events) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    // TODO: Support cursor/pagination from server

    const results = responseData;

    // Artificially limit for now
    let pages = Math.round(results.events.length / 20);
    if (pages === 0) {
      pages = 1;
    }
    if (page > pages) {
      page = 1;
      // TODO: Notify user that the page did not exist
    }
    results._FullCount = results.events.length;
    results._Pages = pages;
    results._CurrentPage = page;
    const startIdx = (20 * (page - 1));
    let endIdx = 20 * page;
    if (endIdx > results.events.length) {
      endIdx = results.events.length;
    }
    // tslint:disable-next-line:prefer-for-of
    for (let x = 0; x < results.events.length; x++) {
      results.events[x]._IndexDisplay = x + 1;
    }
    results.events = results.events.slice(startIdx, endIdx); // {(0, 20, 40), (20, 40, 60)}

    results._Command = command;

    await msgHelper.sendEventsList(results, read, modify, context.getSender(), context.getRoom(), persis);
    return;
  }
}
