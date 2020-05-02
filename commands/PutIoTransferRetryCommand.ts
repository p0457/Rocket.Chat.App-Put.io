import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext, ISlashCommandPreview, ISlashCommandPreviewItem, SlashCommandPreviewItemType } from '@rocket.chat/apps-engine/definition/slashcommands';
import { uuidv4 } from '../lib/helpers/guidCreator';
import * as msgHelper from '../lib/helpers/messageHelper';
import { AppPersistence } from '../lib/persistence';
import { PutIoApp } from '../PutIoApp';
import { retryTransfer, getRssList, pauseRss, getTransfersList } from '../lib/helpers/request';

export class PutIoTransferRetryCommand implements ISlashCommand {
  public command = 'putio-transfer-retry';
  public i18nParamsExample = 'slashcommand_transferretry_params';
  public i18nDescription = 'slashcommand_transferretry_description';
  public providesPreview = true;

  public constructor(private readonly app: PutIoApp) {}

  public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    await retryTransfer(context.getArguments(), read, modify, http, persis, context.getSender(), context.getRoom(), this.command);
    return;
  }

  public async previewer(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<ISlashCommandPreview> {
    const items = Array<ISlashCommandPreviewItem>();

    const transferName = context.getArguments().join(' ');

    let resultsTitle = 'Results for';

    const args = ['filters=(error)'];

    const transfersResult = await getTransfersList(args, read, http, persis, context.getSender(), context.getRoom(), this.command);

    if (transfersResult.hasError()) {
      if (transfersResult.error === 'token') {
        return {
          i18nTitle: 'Token not found!',
          items,
        };
      }
      if (transfersResult.error === '401') {
        return {
          i18nTitle: 'Token Expired!',
          items,
        };
      }
      return {
        i18nTitle: transfersResult.error,
        items,
      };
    }

    if (transfersResult.item && transfersResult.item && Array.isArray(transfersResult.item._FullList) && transfersResult.item._FullList.length > 0) {
      const transfers = transfersResult.item._FullList;

      const matchingTransfers = transfers.filter((transfer) => {
        const transferTitle: string = transfer.name;
        if (!transferName) {
          return true;
        }
        return transferTitle.toLowerCase().trim().indexOf(transferName) !== -1 ||
          transfer.id.toString().indexOf(transferName) !== -1
      });
      if (matchingTransfers.length > 0) {
        let countForPreview = 10;
        if (matchingTransfers.length < countForPreview) {
          countForPreview =  matchingTransfers.length;
        }
        for (let x = 0; x < countForPreview; x++) {
          const transfer = matchingTransfers[x];
          items.push({
            id: transfer.id.toString(),
            type: SlashCommandPreviewItemType.TEXT,
            value: transfer.name,
          });
        }
      } else if (matchingTransfers.length === 0 && transfers.length > 0) {
        resultsTitle = 'No transfers found for name or id';
      } else {
        resultsTitle = 'No Results!';
      }
    }
    return {
      i18nTitle: resultsTitle,
      items,
    };
  }

  public async executePreviewItem(item: ISlashCommandPreviewItem, context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
    await retryTransfer([item.id], read, modify, http, persis, context.getSender(), context.getRoom(), this.command);
    return;
  }
}
