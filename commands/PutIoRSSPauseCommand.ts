import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType, MessageActionButtonsAlignment } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext, ISlashCommandPreview, ISlashCommandPreviewItem, SlashCommandPreviewItemType } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';
import { getRssList, pauseRss } from '../lib/helpers/request';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';

export class PutIoRSSPauseCommand implements ISlashCommand {
  public command = 'putio-rss-pause';
  public i18nParamsExample = 'slashcommand_rsspause_params';
  public i18nDescription = 'slashcommand_rsspause_description';
  public providesPreview = true;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    await pauseRss(context.getArguments(), read, modify, http, persis, context.getSender(), context.getRoom(), this.command);
    return;
  }

  public async previewer(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<ISlashCommandPreview> {
    const items = Array<ISlashCommandPreviewItem>();

    const feedId = context.getArguments().join(' ');

    let resultsTitle = 'Results for';

    if (!feedId || isNaN(Number(feedId))) {
      const rssResult = await getRssList(context, read, http, persis, this.command);

      if (rssResult.hasError()) {
        if (rssResult.error === 'token') {
          return {
            i18nTitle: 'Token not found!',
            items,
          };
        }
        if (rssResult.error === '401') {
          return {
            i18nTitle: 'Token Expired!',
            items,
          };
        }
        return {
          i18nTitle: rssResult.error,
          items,
        };
      }

      if (rssResult.item && rssResult.item && Array.isArray(rssResult.item._FullList) && rssResult.item._FullList.length > 0) {
        const feeds = rssResult.item._FullList;

        const pauseableFeeds = feeds.filter((feed) => {
          const feedTitle: string = feed.title;
          return feed.paused === false && (
            feedTitle.toLowerCase().trim().indexOf(feedId) !== -1 ||
            feed.id.toString().indexOf(feedId) !== -1
          );
        });
        if (pauseableFeeds.length > 0) {
          let countForPreview = 10;
          if (pauseableFeeds.length < countForPreview) {
            countForPreview =  pauseableFeeds.length;
          }
          for (let x = 0; x < countForPreview; x++) {
            const feed = pauseableFeeds[x];
            items.push({
              id: feed.id.toString(),
              type: SlashCommandPreviewItemType.TEXT,
              value: feed.title,
            });
          }
        } else if (pauseableFeeds.length === 0 && feeds.length > 0) {
          resultsTitle = 'No pauseable feeds found for';
        } else {
          resultsTitle = 'No Results!';
        }
      }
    }
    return {
      i18nTitle: resultsTitle,
      items,
    };
  }

  public async executePreviewItem(item: ISlashCommandPreviewItem, context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    await pauseRss([item.id], read, modify, http, persis, context.getSender(), context.getRoom(), this.command);
    return;
  }
}
