import Controller from '@/Controller'
import { BaseService } from '@xmcl/runtime'
import { ControllerPlugin } from './plugin'

export const i18n: ControllerPlugin = function (this: Controller) {
  this.app.once('engine-ready', () => {
    const baseService = this.app.serviceManager.getOrCreateService(BaseService)
    baseService.state.localesSet(['en', 'zh-CN', 'zh-TW', 'ru'])
    this.app.log(`Set locale for the app ${baseService.state.locales}`)
    this.i18n.use(baseService.state.locale)
    this.app.serviceStateManager.subscribe('localeSet', (l) => {
      this.i18n.use(l)
      this.app.log(`Set locale for the app ${l}`)
    })
  })
}
