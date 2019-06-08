export default {
  login: {
    command: 'putio-login',
    usage: '`/putio-login`',
    description: 'Login to Put.io',
  },
  setToken: {
    command: 'putio-token',
    usage: '`/putio-token [TOKEN]`',
    description: 'Store your auth token from Put.io',
  },
  add: {
    command: 'putio-add',
    usage: '`/putio-add [MAGNET LINK]`',
    description: 'Add a magnet link to your Put.io',
  },
  filesList: {
    command: 'putio-files-list',
    usage: '`/putio-files-list (DIRECTORY ID) (p=##)`',
    description: 'List files by directory (leave directory id empty to browse the root level; results are limited to 10 per page)',
  },
  transfersList: {
    command: 'putio-transfers-list',
    usage: '`/putio-transfers-list (NAME) (filters=(finished,unfinished,error)) (p=##)`',
    // tslint:disable-next-line:max-line-length
    description: 'List files by directory (leave directory id empty to browse the root level; results are limited to 10 per page; filters optionally filter results)',
  },
  transferRetry: {
    command: 'putio-transfer-retry',
    usage: '`/putio-transfer-retry [TRANSFER ID]`',
    description: 'Retry a transfer using its Id',
  },
};
