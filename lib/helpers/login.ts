import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import * as msgHelper from './messageHelper';
import { AppPersistence } from '../persistence';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';

export async function login(http: IHttp, token: string, persis: IPersistence, read: IRead, modify: IModify, user: IUser, room: IRoom) {
    const persistence = new AppPersistence(persis, read.getPersistenceReader());
    await persistence.setUserToken(token, user);

    const accountInfoUrl = 'https://api.put.io/v2/account/info';
    const accountInfoResponse = await http.get(accountInfoUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!accountInfoResponse || accountInfoResponse.statusCode === 401 || !accountInfoResponse.content) {
      await msgHelper.sendNotification('Failed to get account info! Token may not be valid.', read, modify, user, room);
      return;
    }

    const accountInfo = JSON.parse(accountInfoResponse.content);
    if (!accountInfo.info) {
      await msgHelper.sendNotification('Failed to parse results!', read, modify, user, room);
      return;
    }

    await persistence.setUserAvatarUrl(accountInfo.info.avatar_url, user);

    await msgHelper.sendNotificationMultipleAttachments([
      {
        collapsed: false,
        color: '#00CE00',
        title: {
          value: 'Token saved!',
        },
      },
    ], read, modify, user, room);

    await msgHelper.sendAccountInfo(accountInfo.info, read, modify, user, room);

    // Remove the auth attempt from persistence
    let currentAuthAttempts = await persistence.getAuthAttempts();
    if (currentAuthAttempts) {
      currentAuthAttempts = currentAuthAttempts.filter((authAttempt) => {
        return authAttempt.userName !== user.username;
      });
      await persistence.setAuthAttempts(currentAuthAttempts);
    }
    return;   
}
  