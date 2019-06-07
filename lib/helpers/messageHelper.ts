import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment, MessageActionButtonsAlignment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { formatBytes } from './bytesConverter';
import usage from './usage';

export async function sendNotification(text: string, read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  const icon = await read.getEnvironmentReader().getSettings().getValueById('putio_icon');
  const username = await read.getEnvironmentReader().getSettings().getValueById('putio_name');
  const sender = await read.getUserReader().getById('rocket.cat');

  modify.getNotifier().notifyUser(user, modify.getCreator().startMessage({
      sender,
      room,
      text,
      groupable: false,
      alias: username,
      avatarUrl: icon,
  }).getMessage());
}

export async function sendNotificationMultipleAttachments(attachments: Array<IMessageAttachment>, read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  const icon = await read.getEnvironmentReader().getSettings().getValueById('putio_icon');
  const username = await read.getEnvironmentReader().getSettings().getValueById('putio_name');
  const sender = await read.getUserReader().getById('rocket.cat');

  modify.getNotifier().notifyUser(user, modify.getCreator().startMessage({
      sender,
      room,
      groupable: false,
      alias: username,
      avatarUrl: icon,
      attachments,
  }).getMessage());
}

export async function sendUsage(read: IRead, modify: IModify, user: IUser, room: IRoom, scope: string, additionalText?): Promise<void> {
  let text = '';

  let usageObj = usage[scope];
  if (!usageObj) {
    for (const p in usage) {
      if (usage.hasOwnProperty(p)) {
        if (usage[p].command === scope) {
          usageObj = usage[p];
        }
      }
    }
  }
  if (usageObj && usageObj.command && usageObj.usage && usageObj.description) {
    text = '*Usage: *' + usageObj.usage + '\n>' + usageObj.description;
  }

  if (additionalText) {
    text = additionalText + '\n' + text;
  }

  // tslint:disable-next-line:max-line-length
  await this.sendNotification(text, read, modify, user, room);
  return;
}

export async function sendAccountInfo(accountInfo, read: IRead, modify: IModify, user: IUser, room: IRoom) {
  const username = accountInfo.username;
  const avatarUrl = accountInfo.avatar_url;

  let diskSize = '';
  let diskUsed = '';
  let diskAvail = '';
  if (accountInfo.disk) {
    diskSize = formatBytes(accountInfo.disk.size);
    diskUsed = formatBytes(accountInfo.disk.used);
    diskAvail = formatBytes(accountInfo.disk.avail);
  }

  const accountActive = accountInfo.account_active;

  let betaUser = false;
  if (accountInfo.settings) {
    betaUser = accountInfo.settings.beta_user;
  }

  const simultaneousDownloadLimit = accountInfo.simultaneous_download_limit;

  const fields = new Array();

  fields.push({
    short: true,
    title: 'Disk Usage',
    value: `${diskSize} size\n${diskUsed} used\n${diskAvail} available`,
  });
  fields.push({
    short: true,
    title: 'Simulataneous Downlooads',
    value: `${simultaneousDownloadLimit}`,
  });

  let text = '';

  if (accountActive === true) {
    text += '*Active Account*\n';
  }
  if (betaUser === true) {
    text += '*Beta User*\n';
  }

  await this.sendNotificationMultipleAttachments([
    {
      collapsed: false,
      color: '#fdcd44',
      title: {
        value: username,
        link: 'https://app.put.io',
      },
      thumbnailUrl: avatarUrl,
      fields,
      text,
    },
  ], read, modify, user, room);
}
