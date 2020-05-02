import * as msgHelper from './messageHelper';
import { AppPersistence } from '../persistence';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { IRead, IModify, IHttp, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { PutIoDTO } from '../PutIoDTO';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { MessageActionType, MessageProcessingType, MessageActionButtonsAlignment, IMessageAction } from '@rocket.chat/apps-engine/definition/messages';

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
  results._FullList = results.feeds;
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

  result.item = results;
  
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

  await msgHelper.sendRssList(rssResult.item, read, modify, context.getSender(), context.getRoom(), persis);
  return;
}

export async function pauseOrResumeRss(args: string[], pauseOrResume: string, read: IRead, modify: IModify, http: IHttp, persis: IPersistence, user: IUser, room: IRoom, slashCommand: string): Promise<void> {
  const [feedId] = args;

  if (!feedId) {
    await msgHelper.sendUsage(read, modify, user, room, slashCommand, 'Feed Id not provided!');
    return;
  }

  const persistence = new AppPersistence(persis, read.getPersistenceReader());
  const token = await persistence.getUserToken(user);
  if (!token) {
    // tslint:disable-next-line:max-line-length
    await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, user, room);
    return;
  }

  const url = `https://api.put.io/v2/rss/${feedId}/${pauseOrResume}`;

  const response = await http.post(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response) {
    await msgHelper.sendNotification('Failed to get a valid response!', read, modify, user, room);
    return;
  }
  if (response.statusCode === 401) {
    await msgHelper.sendTokenExpired(read, modify, user, room, persis);
    return;
  }
  if (response.statusCode !== 200) {
    await msgHelper.sendNotification('Failed to get a valid response!', read, modify, user, room);
    return;
  }

  const actions = new Array<IMessageAction>();
  if (pauseOrResume === 'pause') {
    actions.push({
      type: MessageActionType.BUTTON,
      text: 'Resume Feed',
      msg: `/putio-rss-resume ${feedId} `,
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });
  } else if (pauseOrResume === 'resume') {
    actions.push({
      type: MessageActionType.BUTTON,
      text: 'Pause Feed',
      msg: `/putio-rss-pause ${feedId} `,
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });
  }

  await msgHelper.sendNotificationMultipleAttachments([{
    collapsed: false,
    color: '#fdcd44',
    title: {
      value: `Successfully ${pauseOrResume}d RSS Feed!`,
    },
    actions,
    actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
  }], read, modify, user, room);
  return;
}

export async function pauseRss(args: string[], read: IRead, modify: IModify, http: IHttp, persis: IPersistence, user: IUser, room: IRoom, slashCommand: string): Promise<void> {
  await pauseOrResumeRss(args, 'pause', read, modify, http, persis, user, room, slashCommand);
  return;
}

export async function resumeRss(args: string[], read: IRead, modify: IModify, http: IHttp, persis: IPersistence, user: IUser, room: IRoom, slashCommand: string): Promise<void> {
  await pauseOrResumeRss(args, 'resume', read, modify, http, persis, user, room, slashCommand);
  return;
}

export async function getTransfersList(args: string[], read: IRead, http: IHttp, persis: IPersistence, user: IUser, room: IRoom, slashCommand: string): Promise<PutIoDTO> {
  const result = new PutIoDTO();

  const filtersOrQuery = args.join(' ');

  let query = filtersOrQuery;
  let commandUsed = query;

  const persistence = new AppPersistence(persis, read.getPersistenceReader());
  const token = await persistence.getUserToken(user);
  if (!token) {
    result.error = 'token';
    return result;
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
    if (!responseData.transfers) {
      result.error = 'Failed to get a valid response!';
      return result;
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
        } else if (filter === 'seeding') {
          actualResults = actualResults.filter((result) => {
            return result.status === 'SEEDING';
          });
        } else if (filter === 'completed') {
          actualResults = actualResults.filter((result) => {
            return result.status === 'COMPLETED';
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
    results._FullList = results.transfers;
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
    const command = `/${slashCommand} ${commandUsed}`;
    results._Command = command;
    results._Query = queryDisplay;

    result.item = results;
    return result;
  } catch (e) {
    console.log('[PutIoApp.PutIoTransfersListCommand] Failed to get results!', e);
    result.error = 'Failed to get results!';
    return result;
  }
}

export async function getAndSendTransfersList(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence, slashCommand: string): Promise<void> {
  const transfersResult = await getTransfersList(context.getArguments(), read, http, persis, context.getSender(), context.getRoom(), slashCommand);

  if (transfersResult.hasError()) {
    if (transfersResult.error === 'token') {
      // tslint:disable-next-line:max-line-length
      await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, context.getSender(), context.getRoom());
      return;
    }
    if (transfersResult.error === '401') {
      await msgHelper.sendTokenExpired(read, modify, context.getSender(), context.getRoom(), persis);
      return;
    }
    await msgHelper.sendNotification(transfersResult.error, read, modify, context.getSender(), context.getRoom());
    return;
  }

  await msgHelper.sendTransfersList(transfersResult.item, read, modify, context.getSender(), context.getRoom(), persis);
  return;
}

export async function retryOrCancelTransfer(args: string[], retryOrCancel: string, read: IRead, modify: IModify, http: IHttp, persis: IPersistence, user: IUser, room: IRoom, slashCommand: string): Promise<void> {
  const transfers = [];

  let payloadData = {};

  let successMessage = '';

  if (retryOrCancel === 'retry') {
    const [transferId] = args;

    if (!transferId) {
      await msgHelper.sendUsage(read, modify, user, room, this.command, 'Transfer Id not provided!');
      return;
    }

    payloadData = {
      id: transferId,
    };
  } else if (retryOrCancel === 'cancel') {
    if (!args || args.length === 0) {
      await msgHelper.sendUsage(read, modify, user, room, this.command, 'Transfer Id not provided!');
      return;
    }
    await args.forEach(async (arg) => {
      const tempNumber = Number(arg);
      if (isNaN(tempNumber)) {
        await msgHelper.sendUsage(read, modify, user, room, this.command, 'Bad transfer id `' + arg + '`!');
        return;
      }
    });

    payloadData = {
      transfer_ids: args.join(','),
    };

    successMessage = 'Successfully ran cancel command on transfer!';
  }

  const persistence = new AppPersistence(persis, read.getPersistenceReader());
  const token = await persistence.getUserToken(user);
  if (!token) {
    // tslint:disable-next-line:max-line-length
    await msgHelper.sendNotification('Token not found! Login using `/putio-login` and then set the token using `/putio-set-token`', read, modify, user, room);
    return;
  }

  const url = `https://api.put.io/v2/transfers/${retryOrCancel}`;
  const response = await http.post(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    data: payloadData,
  });

  let responseData;

  if (response.content) {
    responseData = JSON.parse(response.content);
  }
  if (!response) {
    await msgHelper.sendNotification('Failed to get a valid response!', read, modify, user, room);
    return;
  }
  if (response.statusCode === 401) {
    await msgHelper.sendTokenExpired(read, modify, user, room, persis);
    return;
  }
  if (response.statusCode !== 200 || !response.content) {
    await msgHelper.sendNotification('Failed to get a valid response!', read, modify, user, room);
    return;
  }

  if (retryOrCancel === 'retry') {
    if (responseData.transfer && responseData.transfer.name) {
      successMessage = `Successfully triggered a retry for '${responseData.transfer.name}'!`;
    } else {
      successMessage = 'Successfully triggered a retry for transfer!';
    }
  }

  await msgHelper.sendNotification(successMessage, read, modify, user, room);
  return;
}

export async function retryTransfer(args: string[], read: IRead, modify: IModify, http: IHttp, persis: IPersistence, user: IUser, room: IRoom, slashCommand: string): Promise<void> {
  await retryOrCancelTransfer(args, 'retry', read, modify, http, persis, user, room, slashCommand);
  return;
}

export async function cancelTransfer(args: string[], read: IRead, modify: IModify, http: IHttp, persis: IPersistence, user: IUser, room: IRoom, slashCommand: string): Promise<void> {
  await retryOrCancelTransfer(args, 'cancel', read, modify, http, persis, user, room, slashCommand);
  return;
}