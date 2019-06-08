import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';

export class PutIoTransfersListCommand implements ISlashCommand {
  public command = 'putio-transfers-list';
  public i18nParamsExample = 'slashcommand_transferslist_params';
  public i18nDescription = 'slashcommand_transferslist_description';
  public providesPreview = false;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    const filtersOrQuery = context.getArguments().join(' ');

    let query = filtersOrQuery;
    let commandUsed = query;

    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    const token = await persistence.getUserToken(context.getSender());
    if (!token) {
      // tslint:disable-next-line:max-line-length
      await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, context.getSender(), context.getRoom());
      return;
    }

    try {
      let m;

      // PAGE
      const pageRegex = /p=([0-9][0-9]?)/gm; // Shouldn't be more than 99 pages...
      let pageText = '';
      let pageTextToRemove = '';
      let page = 1;

      // tslint:disable-next-line:no-conditional-assignment
      while ((m = pageRegex.exec(filtersOrQuery)) !== null) {
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

      // FILTERS
      const filtersRegex = /filters=\((.*?)\)/gm;
      let filtersText = '';
      let filtersTextToRemove = '';
      const filters = new Array();

      // tslint:disable-next-line:no-conditional-assignment
      while ((m = filtersRegex.exec(filtersOrQuery)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === filtersRegex.lastIndex) {
          filtersRegex.lastIndex++;
        }
        m.forEach((match, groupIndex) => {
          if (groupIndex === 0) {
            filtersTextToRemove = match;
          } else if (groupIndex === 1) {
            filtersText = match;
          }
        });
      }

      if (filtersText && filtersText !== '' && filtersTextToRemove && filtersTextToRemove !== '') {
        // Set filters array
        const tempFilters = filtersText.split(',');
        tempFilters.forEach((filter) => {
          filters.push(filter.toLowerCase().trim());
        });
        // Update query
        query = query.replace(filtersTextToRemove, '').trim().toLowerCase();
      }

      const url = 'https://api.put.io/v2/transfers/list';
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

      if (!responseData.transfers) {
        await msgHelper.sendNotification('Failed to get a valid response!', read, modify, context.getSender(), context.getRoom());
        return;
      }

      const results = responseData;

      // Filter out if necessary
      let actualResults = results.transfers;
      if (filters && filters.length > 0) {
        filters.forEach((filter) => {
          if (filter === 'finished') {
            actualResults = actualResults.filter((result) => {
              return result.status === 'SEEDING' || result.status === 'COMPLETED' || result.completion_percent === 100;
            });
          } else if (filter === 'unfinished') {
            actualResults = actualResults.filter((result) => {
              return result.status === 'DOWNLOADING' && result.completio_percent !== 100;
            });
          } else if (filter === 'error') {
            actualResults = actualResults.filter((result) => {
              return result.status === 'ERROR' && result.completion_percent !== 100;
            });
          }
        });
      }

      if (query) {
        actualResults = actualResults.filter((result) => {
          return result.name.toLowerCase().indexOf(query.toLowerCase().trim()) !== -1;
        });
      }

      results.transfers = actualResults;
      let queryDisplay = '';
      if (filtersText) {
        queryDisplay += `filters=(${filtersText}) `;
      }
      queryDisplay += query;
      // Artificially limit for now
      let pages = Math.round(results.transfers.length / 10);
      if (pages === 0) {
        pages = 1;
      }
      if (page > pages) {
        page = 1;
        // TODO: Notify user that the page did not exist
      }
      results._FullCount = results.transfers.length;
      results._Pages = pages;
      results._CurrentPage = page;
      const startIdx = (10 * (page - 1));
      let endIdx = 10 * page;
      if (endIdx > results.transfers.length) {
        endIdx = results.transfers.length;
      }
      // tslint:disable-next-line:prefer-for-of
      for (let x = 0; x < results.transfers.length; x++) {
        results.transfers[x]._IndexDisplay = x + 1;
      }
      results.transfers = results.transfers.slice(startIdx, endIdx); // {(0, 20, 40), (20, 40, 60)}
      const command = `/${this.command} ${commandUsed}`;
      results._Command = command;
      results._Query = queryDisplay;

      await msgHelper.sendTransfersList(results, read, modify, context.getSender(), context.getRoom(), persis);
      return;
    } catch (e) {
      console.log('[PutIoApp.PutIoTransfersListCommand] Failed to get results!', e);
      await msgHelper.sendNotification('Failed to get results!', read, modify, context.getSender(), context.getRoom());
      return;
    }
  }
}
