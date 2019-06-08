import {
  IAppAccessors, IConfigurationExtend, IEnvironmentRead, ILogger,
} from '@rocket.chat/apps-engine/definition/accessors';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { PutIoAddCommand } from './commands/PutIoAddCommand';
import { PutIoCommand } from './commands/PutIoCommand';
import { PutIoLoginCommand } from './commands/PutIoLoginCommand';
import { PutIoSetTokenCommand } from './commands/PutIoSetTokenCommand';
import { OAuthWebhookEndpooint } from './endpoints/oauthWebhook';
import { TransferCompleteWebhookEndpooint } from './endpoints/transferCompleteWebhook';

export class PutIoApp extends App {
    constructor(info: IAppInfo, logger: ILogger, accessors?: IAppAccessors) {
        super(info, logger, accessors);
    }

    protected async extendConfiguration(configuration: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
      await configuration.settings.provideSetting({
        id: 'putio_name',
        type: SettingType.STRING,
        packageValue: 'Put.io',
        required: true,
        public: false,
        i18nLabel: 'customize_name',
        i18nDescription: 'customize_name_description',
      });

      await configuration.settings.provideSetting({
        id: 'putio_icon',
        type: SettingType.STRING,
        packageValue: 'https://github.com/tgardner851/Rocket.Chat.App-Put.io/raw/master/icon.png',
        required: true,
        public: false,
        i18nLabel: 'customize_icon',
        i18nDescription: 'customize_icon_description',
      });

      await configuration.api.provideApi({
        visibility: ApiVisibility.PRIVATE,
        security: ApiSecurity.UNSECURE,
        endpoints: [new TransferCompleteWebhookEndpooint(this)],
      });

      await configuration.api.provideApi({
        visibility: ApiVisibility.PUBLIC,
        security: ApiSecurity.UNSECURE,
        endpoints: [new OAuthWebhookEndpooint(this)],
      });

      await configuration.settings.provideSetting({
        id: 'putio_clientid',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'customize_clientid',
        i18nDescription: 'customize_clientid_description',
      });

      await configuration.settings.provideSetting({
        id: 'putio_clientsecret',
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: 'customize_clientsecret',
        i18nDescription: 'customize_clientsecret_description',
      });

      await configuration.slashCommands.provideSlashCommand(new PutIoCommand(this));
      await configuration.slashCommands.provideSlashCommand(new PutIoLoginCommand(this));
      await configuration.slashCommands.provideSlashCommand(new PutIoSetTokenCommand(this));
      await configuration.slashCommands.provideSlashCommand(new PutIoAddCommand(this));
    }
}
