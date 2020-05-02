import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';
import { getAndSendRssList } from '../lib/helpers/request';

export class PutIoRSSListCommand implements ISlashCommand {
  public command = 'putio-rss-list';
  public i18nParamsExample = 'slashcommand_rsslist_params';
  public i18nDescription = 'slashcommand_rsslist_description';
  public providesPreview = false;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    await getAndSendRssList(context, read, modify, http, persis, this.command);
    return;
  }
}
