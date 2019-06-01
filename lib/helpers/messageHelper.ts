import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment, MessageActionButtonsAlignment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { formatBytes } from './bytesConverter';

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

export async function sendNotificationSingleAttachment(attachment: IMessageAttachment, read: IRead, modify: IModify, user: IUser, room: IRoom): Promise<void> {
  const icon = await read.getEnvironmentReader().getSettings().getValueById('putio_icon');
  const username = await read.getEnvironmentReader().getSettings().getValueById('putio_name');
  const sender = await read.getUserReader().getById('rocket.cat');

  modify.getNotifier().notifyUser(user, modify.getCreator().startMessage({
      sender,
      room,
      groupable: false,
      alias: username,
      avatarUrl: icon,
      attachments: [attachment],
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
