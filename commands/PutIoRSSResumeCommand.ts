import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext, ISlashCommandPreview, ISlashCommandPreviewItem, SlashCommandPreviewItemType } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';
import { getRssList, resumeRss } from '../lib/helpers/request';

export class PutIoRSSResumeCommand implements ISlashCommand {
  public command = 'putio-rss-resume';
  public i18nParamsExample = 'slashcommand_rssresume_params';
  public i18nDescription = 'slashcommand_rssresume_description';
  public providesPreview = true;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    await resumeRss(context.getArguments(), read, modify, http, persis, context.getSender(), context.getRoom());
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

      if (rssResult.item && rssResult.item && Array.isArray(rssResult.item.feeds) && rssResult.item.feeds.length > 0) {
        const feeds = rssResult.item.feeds;

        const resumeableFeeds = feeds.filter((feed) => {
          const feedTitle: string = feed.title;
          return feed.paused === true && (
            feedTitle.toLowerCase().trim().indexOf(feedId) !== -1 ||
            feed.id.toString().indexOf(feedId) !== -1
          );
        });
        if (resumeableFeeds.length > 0) {
          let countForPreview = 10;
          if (resumeableFeeds.length < countForPreview) {
            countForPreview =  resumeableFeeds.length;
          }
          for (let x = 0; x < countForPreview; x++) {
            const feed = resumeableFeeds[x];
            items.push({
              id: feed.id.toString(),
              type: SlashCommandPreviewItemType.TEXT,
              value: feed.title,
            });
          }
        }
        else if (resumeableFeeds.length === 0 && feeds.length > 0) {
          resultsTitle = 'No resumeable feeds found for';
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
    await resumeRss([item.id], read, modify, http, persis, context.getSender(), context.getRoom());
    return;
  }
}
