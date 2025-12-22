import { EmailProvider } from './email-provider';
import { GmailProvider } from './gmail-provider';
import { GenericEmailProvider, ImapConfig, SmtpConfig } from './generic-provider';
import { StoredTokens } from './storage';

export type ProviderType = 'gmail' | 'imap';

export interface AccountConfig {
    type: ProviderType;
    gmailTokens?: StoredTokens;
    imapConfig?: ImapConfig;
    smtpConfig?: SmtpConfig;
}

export function createEmailProvider(config: AccountConfig): EmailProvider {
    switch (config.type) {
        case 'gmail':
            if (!config.gmailTokens) {
                throw new Error('Gmail tokens required for Gmail provider');
            }
            return new GmailProvider(config.gmailTokens);

        case 'imap':
            if (!config.imapConfig || !config.smtpConfig) {
                throw new Error('IMAP and SMTP config required for IMAP provider');
            }
            return new GenericEmailProvider(config.imapConfig, config.smtpConfig);

        default:
            throw new Error(`Unsupported provider type: ${config.type}`);
    }
}
