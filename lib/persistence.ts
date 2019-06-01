import { IPersistence, IPersistenceRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export class AppPersistence {
  constructor(private readonly persistence: IPersistence, private readonly persistenceRead: IPersistenceRead) {}
}
