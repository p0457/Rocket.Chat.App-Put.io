import * as msgHelper from './messageHelper';
import { AppPersistence } from '../persistence';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { IRead, IModify, IHttp, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { PutIoDTO } from '../PutIoDTO';

export async function getRssList(context: SlashCommandContext, read: IRead, http: IHttp, persis: IPersistence, slashCommand: string): Promise<PutIoDTO> {
  const result = new PutIoDTO();

  const [pageArg] = context.getArguments();

  const command = `/${slashCommand}`;

  const persistence = new AppPersistence(persis, read.getPersistenceReader());
  const token = await persistence.getUserToken(context.getSender());
  if (!token) {
    result.error = 'token';
    return result;
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

  const url = 'https://api.put.io/v2/rss/list';

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
    result.error = 'Failed to get a valid response!';
    return result;
  }
  if (response.statusCode === 401) {
    result.error = '401';
    return result;
  }
  if (response.statusCode !== 200 || !response.content) {
    result.error = 'Failed to get a valid response!';
    return result;
  }

  if (!responseData.feeds) {
    result.error = 'Failed to get a valid response!';
    return result;
  }

  // TODO: Support cursor/pagination from server

  const results = responseData;

  // Artificially limit for now
  let pages = Math.round(results.feeds.length / 20);
  if (pages === 0) {
    pages = 1;
  }
  if (page > pages) {
    page = 1;
    // TODO: Notify user that the page did not exist
  }
  results._FullCount = results.feeds.length;
  results._Pages = pages;
  results._CurrentPage = page;
  const startIdx = (20 * (page - 1));
  let endIdx = 20 * page;
  if (endIdx > results.feeds.length) {
    endIdx = results.feeds.length;
  }
  // tslint:disable-next-line:prefer-for-of
  for (let x = 0; x < results.feeds.length; x++) {
    results.feeds[x]._IndexDisplay = x + 1;
  }
  results.feeds = results.feeds.slice(startIdx, endIdx); // {(0, 20, 40), (20, 40, 60)}

  results._Command = command;

  result.items = results;
  
  return result;
}

export async function getAndSendRssList(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence, slashCommand: string): Promise<void> {
  const rssResult = await getRssList(context, read, http, persis, slashCommand);

  if (rssResult.hasError()) {
    if (rssResult.error === 'token') {
      // tslint:disable-next-line:max-line-length
      await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (rssResult.error === '401') {
      await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom(), persis);
      return;
    }
    await msgHelper.sendNotification(rssResult.error, read, modify, context.getSender(), context.getRoom());
    return;
  }

  await msgHelper.sendRssList(rssResult.items, read, modify, context.getSender(), context.getRoom(), persis);
  return;
}