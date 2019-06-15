import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';

export class PutIoSearchFilesCommand implements ISlashCommand {
  public command = 'putio-search-files';
  public i18nParamsExample = 'slashcommand_searchfiles_params';
  public i18nDescription = 'slashcommand_searchfiles_description';
  public providesPreview = false;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const args = context.getArguments();
    if (!args || args.length === 0) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Must provide a query!');
      return;
    }

    const queryOrPage = args.join(' ');
    let query = queryOrPage;
    let commandUsed = `/${this.command} ${queryOrPage}`;

    // PAGE
    const pageRegex = /p=([0-9][0-9]?)/gm; // Shouldn't be more than 99 pages...
    let pageText = '';
    let pageTextToRemove = '';
    let page = 1;
    let m;

    // tslint:disable-next-line:no-conditional-assignment
    while ((m = pageRegex.exec(queryOrPage)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === pageRegex.lastIndex) {
          pageRegex.lastIndex++;
        }
        m.forEach((match, groupIndex) => {
          if (groupIndex === 0) {
            pageTextToRemove = match;
          } else if (groupIndex === 1) {
            pageText = match;
          }
        });
    }

    if (pageText && pageText !== '' && pageTextToRemove && pageTextToRemove !== '') {
      // Attempt to parse
      page = Math.round(parseFloat(pageText));
      if (isNaN(page) || page <= 0) {
        page = 1;
      }
      // Update query
      query = query.replace(pageTextToRemove, '');
      // Update command used (which can trigger page changes)
      commandUsed = commandUsed.replace(pageTextToRemove, '');
    }

    query = query.trim();
    if (!query) {
      await msgHelper.sendUsage(read, modify, context.getSender(), context.getRoom(), this.command, 'Query was invalid!');
      return;
    }

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    const token = await persistence.getUserToken(context.getSender());
    if (!token) {
      // tslint:disable-next-line:max-line-length
      await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, context.getSender(), context.getRoom());
      return;
    }

    const url = 'https://api.put.io/v2/files/search';
    const params = {
      per_page: '1000',
      query,
    };

    const response = await http.get(url, {
      params,
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

    if (!responseData.files) {
      await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
      return;
    }

    // TODO: Support cursor/pagination from server

    const results = responseData;

    // Artificially limit for now
    let pages = Math.round(results.files.length / 10);
    if (pages === 0) {
      pages = 1;
    }
    if (page > pages) {
      page = 1;
      // TODO: Notify user that the page did not exist
    }
    results._FullCount = results.files.length;
    results._Pages = pages;
    results._CurrentPage = page;
    const startIdx = (10 * (page - 1));
    let endIdx = 10 * page;
    if (endIdx > results.files.length) {
      endIdx = results.files.length;
    }
    // tslint:disable-next-line:prefer-for-of
    for (let x = 0; x < results.files.length; x++) {
      results.files[x]._IndexDisplay = x + 1;
    }
    results.files = results.files.slice(startIdx, endIdx); // {(0, 20, 40), (20, 40, 60)}

    results._Command = commandUsed;

    await msgHelper.sendFilesList(results, read, modify, context.getSender(), context.getRoom(), persis);
    return;
  }
}
