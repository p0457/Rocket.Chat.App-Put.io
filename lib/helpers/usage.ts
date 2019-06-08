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
  fiesList: {
    command: 'putio-files-list',
    usage: '`/putio-files-list (DIRECTORY ID) (p=##)`',
    description: 'List files by directory (leave directory id empty to browse the root level; results are limited to 20 per page)',
  },
};
