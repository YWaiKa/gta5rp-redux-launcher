export const IPC = {
  // config
  configGet: 'config:get',
  configUpdate: 'config:update',
  pickGtaFolder: 'config:pickGtaFolder',

  // dialogs
  pickFile: 'dialog:pickFile',

  // remote data
  dataFetch: 'data:fetch',

  // install
  installRedux: 'install:redux',
  uninstallRedux: 'install:uninstall',
  installedList: 'install:list',
  openGtaFolder: 'install:openFolder',

  // admin
  verifyToken: 'admin:verifyToken',
  ensureBackend: 'admin:ensureBackend',
  publishCategory: 'admin:publishCategory',
  deleteCategory: 'admin:deleteCategory',
  publishRedux: 'admin:publishRedux',
  updateRedux: 'admin:updateRedux',
  deleteRedux: 'admin:deleteRedux'
} as const
