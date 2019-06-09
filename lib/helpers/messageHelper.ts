import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAction, IMessageAttachment, IMessageAttachmentField, MessageActionButtonsAlignment, MessageActionType, MessageProcessingType } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppPersistence } from '../persistence';
import { formatBytes } from './bytesConverter';
import { formatDate, timeSince } from './dates';
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

export async function sendTokenExpired(read: IRead, modify: IModify, user: IUser, room: IRoom, persis: IPersistence): Promise<void> {
  const persistence = new AppPersistence(persis, read.getPersistenceReader());
  const userThumbUrl = await persistence.getUserAvatarUrl(user);
  await sendNotificationMultipleAttachments([
      {
      collapsed: false,
      color: '#e10000',
      thumbnailUrl: userThumbUrl,
      title: {
        value: 'Token Expired!',
      },
      text: 'Please login again using `/putio-login`',
    },
  ], read, modify, user, room);
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

export async function sendSuccessfulTransferAdd(data, read: IRead, modify: IModify, user: IUser, room: IRoom, persis: IPersistence) {
  const persistence = new AppPersistence(persis, read.getPersistenceReader());
  const avatarUrl = await persistence.getUserAvatarUrl(user);

  const fileName = data.name;
  const fileSize = formatBytes(data.size);
  const link = data.torrent_link;

  const fields = new Array();

  fields.push({
    short: true,
    title: 'Hash',
    value: `${data.hash}`,
  });
  fields.push({
    short: true,
    title: 'File Size',
    value: `${fileSize}`,
  });

  await this.sendNotificationMultipleAttachments([
    {
      collapsed: false,
      color: '#fdcd44',
      title: {
        value: `Transfer Started! [${fileName}]`,
        link,
      },
      thumbnailUrl: avatarUrl,
      fields,
    },
  ], read, modify, user, room);
}

export async function sendFilesList(files, read: IRead, modify: IModify, user: IUser, room: IRoom, persis: IPersistence) {
  const attachments = new Array<IMessageAttachment>();

  if (files.parent) {
    const actions = new Array<IMessageAction>();
    if (files.parent.parent_id !== null && files.parent.parent_id >= 0) {
      let command = '/putio-files-list ';
      if (files.parent.parent_id > 0) {
        command += `${files.parent.parent_id}`;
      }
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'View Root Level',
        msg: '/putio-files-list ',
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'View One Level Up',
        msg: command,
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    }
    if (files._CurrentPage > 1) {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'Previous Page',
        msg: files._Command.trim() + ' p=' + (files._CurrentPage - 1).toString(),
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    }
    if (files._Pages > files._CurrentPage) {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'Next Page',
        msg: files._Command.trim() + ' p=' + (files._CurrentPage + 1).toString(),
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    }
    attachments.push(
      {
        collapsed: false,
        color: '#fdcd44',
        title: {
          value: `[PARENT ${files.parent.folder_type} FOLDER] ${files.parent.name}`,
        },
        thumbnailUrl: files.parent.icon,
        actions,
        actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
        text: `*Size: *${formatBytes(files.parent.size)}\n*Files: *${files._FullCount}\n*Created: *${formatDate(files.parent.created_at)}` +
          `\n_Page ${files._CurrentPage} of ${files._Pages}_\n\n_Results are limited to 10 items per page_`,
      },
    );
  }

  files.files.forEach((file) => {
    const actions = new Array<IMessageAction>();

    if (file.file_type === 'FOLDER') {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'View Folder Contents',
        msg: `/putio-files-list ${file.id}`,
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    }

    // TEXT
    let text = `*Size: *${formatBytes(file.size)}`;
    if (file.file_type !== 'FOLDER') {
      text += '\n*Content Type: *' + file.content_type;
    }
    text += '\n*Created: * ' + formatDate(file.created_at);

    // INDEX FOR DISPLAY
    let indexDisplay = file._IndexDisplay.toString();
    if (files._FullCount >= 1000) {
      if (file._IndexDisplay < 10) {
        indexDisplay = `000${file._IndexDisplay.toString()}`;
      } else if (file._IndexDisplay < 100) {
        indexDisplay = `00${file._IndexDisplay.toString()}`;
      } else if (file._IndexDisplay < 1000) {
        indexDisplay = `0${file._IndexDisplay.toString()}`;
      }
    } else if (files._FullCount >= 100) {
      if (file._IndexDisplay < 10) {
        indexDisplay = `00${file._IndexDisplay.toString()}`;
      } else if (file._IndexDisplay < 100) {
        indexDisplay = `0${file._IndexDisplay.toString()}`;
      }
    } else if (files._FullCount >= 10) {
      if (file._IndexDisplay < 10) {
        indexDisplay = `0${file._IndexDisplay.toString()}`;
      }
    }

    // ATTACHMENT TITLE
    let title = '';
    if (file.folder_type) {
      title = `[${file.folder_type} ${file.file_type}] ${file.name}`;
    } else {
      title = `[${file.file_type}] ${file.name}`;
    }
    title = `(#${indexDisplay}) ${title}`;

    attachments.push(
      {
        collapsed: false,
        color: '#fdcd44',
        title: {
          value: title,
        },
        thumbnailUrl: file.icon,
        imageUrl: file.screenshot ? file.screenshot : '',
        actions,
        actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
        text,
      },
    );
  });

  await this.sendNotificationMultipleAttachments(attachments, read, modify, user, room);
}

export async function sendTransfersList(transfers, read: IRead, modify: IModify, user: IUser, room: IRoom, persis: IPersistence) {
  const attachments = new Array<IMessageAttachment>();

  const resultsActions = new Array<IMessageAction>();
  if (transfers._CurrentPage > 1) {
    resultsActions.push({
      type: MessageActionType.BUTTON,
      text: 'Previous Page',
      msg: transfers._Command.trim() + ' p=' + (transfers._CurrentPage - 1).toString(),
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });
  }
  if (transfers._Pages > transfers._CurrentPage) {
    resultsActions.push({
      type: MessageActionType.BUTTON,
      text: 'Next Page',
      msg: transfers._Command.trim() + ' p=' + (transfers._CurrentPage + 1).toString(),
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });
  }
  resultsActions.push({
    type: MessageActionType.BUTTON,
    text: 'Search Again',
    msg: transfers._Command,
    msg_in_chat_window: true,
    msg_processing_type: MessageProcessingType.RespondWithMessage,
  });

  // Initial attachment for results count
  let resultsText = transfers._Query ? ('*Query: *`' + transfers._Query.trim() + '`') : '';
  resultsText += '\n*Current Page* ' + transfers._CurrentPage;
  resultsText += '\n*Pages* ' + transfers._Pages;
  if (resultsText.startsWith('\n')) {
    resultsText = resultsText.substring(1, resultsText.length); // Remove first '\n'
  }

  attachments.push({
    collapsed: false,
    color: '#00CE00',
    title: {
      value: 'Results (' + transfers._FullCount + ')',
    },
    text: resultsText,
    actions: resultsActions,
    actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
  });

  transfers.transfers.forEach((transfer) => {
    // FIELDS
    const fields = new Array<IMessageAttachmentField>();

    fields.push({
      short: true,
      title: 'Created',
      value: `${formatDate(transfer.created_at)}\n(${timeSince(transfer.created_at)})`,
    });
    if (transfer.tracker) {
      fields.push({
        short: true,
        title: 'Tracker',
        value: transfer.tracker,
      });
    }
    fields.push({
      short: true,
      title: 'Size',
      value: `${formatBytes(transfer.size)}`,
    });
    fields.push({
      short: true,
      title: 'Downloaded/Uploaded',
      // tslint:disable-next-line:max-line-length
      value: `${formatBytes(transfer.downloaded)} @ ${formatBytes(transfer.down_speed)}/sec\n${formatBytes(transfer.uploaded)} @ ${formatBytes(transfer.up_speed)}/sec`,
    });
    fields.push({
      short: true,
      title: 'Ratio',
      value: transfer.current_ratio,
    });
    fields.push({
      short: true,
      title: 'Peers',
      // tslint:disable-next-line:max-line-length
      value: transfer.peers_connected.toString() !== '0' ? `${transfer.peers_connected} (${transfer.peers_sending_to_us} active in / ${transfer.peers_getting_from_us} active out)` : `0`,
    });

    // ACTIONS
    const actions = new Array<IMessageAction>();

    if (transfer.status === 'ERROR') {
      actions.push({
        type: MessageActionType.BUTTON,
        text: 'Retry',
        msg: `/putio-transfer-retry ${transfer.id}`,
        msg_in_chat_window: true,
        msg_processing_type: MessageProcessingType.RespondWithMessage,
      });
    }
    let cancelText = 'Cancel';
    if (transfer.status === 'SEEDING') {
      cancelText = 'Stop Seeding';
    }
    if (transfer.status === 'COMPLETED') {
      cancelText = 'Clear';
    }
    actions.push({
      type: MessageActionType.BUTTON,
      text: cancelText,
      msg: `/putio-transfers-cancel ${transfer.id}`,
      msg_in_chat_window: true,
      msg_processing_type: MessageProcessingType.RespondWithMessage,
    });

    // TEXT
    let text = `*Status: *${transfer.status_message.replace('\n', ' ')}`;
    if (transfer.estimated_time) {
      text += `\n*ETA: *${transfer.estimated_time}`;
    }
    if (transfer.finished_at) {
      text += `\n*Finished At *${formatDate(transfer.finished_at)}`;
    }

    // INDEX FOR DISPLAY
    let indexDisplay = transfer._IndexDisplay.toString();
    if (transfers._FullCount >= 1000) {
      if (transfer._IndexDisplay < 10) {
        indexDisplay = `000${transfer._IndexDisplay.toString()}`;
      } else if (transfer._IndexDisplay < 100) {
        indexDisplay = `00${transfer._IndexDisplay.toString()}`;
      } else if (transfer._IndexDisplay < 1000) {
        indexDisplay = `0${transfer._IndexDisplay.toString()}`;
      }
    } else if (transfers._FullCount >= 100) {
      if (transfer._IndexDisplay < 10) {
        indexDisplay = `00${transfer._IndexDisplay.toString()}`;
      } else if (transfer._IndexDisplay < 100) {
        indexDisplay = `0${transfer._IndexDisplay.toString()}`;
      }
    } else if (transfers._FullCount >= 10) {
      if (transfer._IndexDisplay < 10) {
        indexDisplay = `0${transfer._IndexDisplay.toString()}`;
      }
    }

    // ATTACHMENT TITLE
    if (transfer.status === 'COMPLETED' || transfer.status === 'SEEDING') {
      transfer.completion_percent = 100;
    }
    const title = `(#${indexDisplay}) [${transfer.status} ${transfer.completion_percent}%] ${transfer.name}`;

    attachments.push(
      {
        collapsed: false,
        color: '#fdcd44',
        title: {
          value: title,
          link: transfer.torrent_link,
        },
        fields,
        actions,
        actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
        text,
      },
    );
  });

  await this.sendNotificationMultipleAttachments(attachments, read, modify, user, room);
}
