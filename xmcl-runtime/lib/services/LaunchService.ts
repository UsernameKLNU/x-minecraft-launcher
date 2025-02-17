import { createMinecraftProcessWatcher, generateArguments, launch, LaunchOption, MinecraftFolder, ResolvedVersion, Version } from '@xmcl/core'
import { LaunchException, LaunchOptions, LaunchService as ILaunchService, LaunchServiceKey, LaunchState } from '@xmcl/runtime-api'
import { ChildProcess } from 'child_process'
import { EOL } from 'os'
import LauncherApp from '../app/LauncherApp'
import { JavaValidation } from '../entities/java'
import { DiagnoseService } from './DiagnoseService'
import { ExternalAuthSkinService } from './ExternalAuthSkinService'
import { InstanceJavaService } from './InstanceJavaService'
import { InstanceResourcePackService } from './InstanceResourcePacksService'
import { InstanceService } from './InstanceService'
import { InstanceShaderPacksService } from './InstanceShaderPacksService'
import { InstanceVersionService } from './InstanceVersionService'
import { JavaService } from './JavaService'
import { Inject, StatefulService } from './Service'
import { UserService } from './UserService'
import { VersionService } from './VersionService'

export class LaunchService extends StatefulService<LaunchState> implements ILaunchService {
  private launchedProcesses: ChildProcess[] = []

  constructor(app: LauncherApp,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
    @Inject(ExternalAuthSkinService) private externalAuthSkinService: ExternalAuthSkinService,
    @Inject(InstanceResourcePackService) private instanceResourcePackService: InstanceResourcePackService,
    @Inject(InstanceShaderPacksService) private instanceShaderPackService: InstanceShaderPacksService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceJavaService) private instanceJavaService: InstanceJavaService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app, LaunchServiceKey, () => new LaunchState())
  }

  async generateArguments() {
    const instance = this.instanceService.state.instance
    const user = this.userService.state
    const gameProfile = user.gameProfile

    const minecraftFolder = new MinecraftFolder(instance.path)
    const instanceJava = this.instanceJavaService.state.java
    if (!instanceJava) {
      throw new Error('No valid java')
    }
    const javaPath = instanceJava.path

    const instanceVersion = this.instanceVersionService.state.version

    if (!instanceVersion) {
      throw new LaunchException({
        type: 'launchNoVersionInstalled',
        version: instance.version,
        minecraft: instance.runtime.minecraft,
        forge: instance.runtime.forge,
        fabric: instance.runtime.fabricLoader,
      })
    }
    const version = instanceVersion.id
    const useAuthLib = this.userService.state.isThirdPartyAuthentication

    /**
       * Build launch condition
       */
    const option: LaunchOption = {
      gameProfile,
      accessToken: user.user.accessToken,
      properties: {},
      gamePath: minecraftFolder.root,
      resourcePath: this.getPath(),
      javaPath,
      minMemory: instance.minMemory && instance.minMemory > 0 ? instance.minMemory : undefined,
      maxMemory: instance.maxMemory && instance.maxMemory > 0 ? instance.maxMemory : undefined,
      version,
      extraExecOption: {
        detached: true,
        cwd: minecraftFolder.root,
      },
      extraJVMArgs: instance.vmOptions,
      extraMCArgs: instance.mcOptions,
      yggdrasilAgent: useAuthLib
        ? {
          jar: await this.externalAuthSkinService.installAuthLibInjection(),
          server: user.authService.hostName,
        }
        : undefined,
    }

    return generateArguments(option)
  }

  async kill() {
    if (this.launchedProcesses.length > 0) {
      const last = this.launchedProcesses.pop()
      last!.kill()
    }
  }

  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @param force
   * @returns Does this launch request success?
   */
  async launch(options?: LaunchOptions) {
    try {
      if (this.state.status !== 'idle') {
        return false
      }

      /**
       * current selected profile
       */
      const instance = this.instanceService.state.instance
      const user = this.userService.state
      const gameProfile = user.gameProfile

      await this.userService.refreshStatus()

      if (!options?.force) {
        this.state.launchStatus('checkingProblems')
        const issues = this.diagnoseService.state.issues
        for (let problems = issues.filter(p => p.autoFix), i = 0;
          problems.length !== 0 && i < 1;
          problems = issues.filter(p => p.autoFix), i += 1) {
          await this.diagnoseService.fix(issues.filter(p => !p.optional && p.autoFix))
        }
      }

      if (this.state.status === 'idle') { // check if we have cancel (set to ready) this launch
        return false
      }

      this.state.launchStatus('launching')

      const minecraftFolder = new MinecraftFolder(options?.gameDirectory ?? instance.path)

      let version: ResolvedVersion | undefined

      if (options?.version) {
        this.log(`Override the version: ${options.version}`)
        version = this.versionService.getLocalVersion(options.version)
        if (!version) {
          try {
            version = await Version.parse(this.getPath(), options.version)
          } catch (e) {
            this.warn(`Cannot use override version: ${options.version}`)
            this.warn(e)
          }
        }
      } else {
        version = this.instanceVersionService.state.version
      }

      if (!version) {
        throw new LaunchException({
          type: 'launchNoVersionInstalled',
          override: options?.version,
          minecraft: instance.runtime.minecraft,
          forge: instance.runtime.forge,
          fabric: instance.runtime.fabricLoader,
        })
      }

      this.log(`Will launch with ${version} version.`)

      const instanceJava = this.javaService.getJavaForVersion(version.javaVersion)

      const javaPath = instance.java || instanceJava?.path

      if (!javaPath) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath: javaPath || '' }, 'Cannot launch without a valid java')
      }

      const useAuthLib = user.isThirdPartyAuthentication

      /**
       * Build launch condition
       */
      const option: LaunchOption = {
        gameProfile,
        accessToken: user.user.accessToken,
        properties: {},
        gamePath: minecraftFolder.root,
        resourcePath: this.getPath(),
        javaPath,
        minMemory: instance.minMemory > 0 ? instance.minMemory : undefined,
        maxMemory: instance.maxMemory > 0 ? instance.maxMemory : undefined,
        version,
        extraExecOption: {
          detached: true,
          cwd: minecraftFolder.root,
        },
        extraJVMArgs: instance.vmOptions,
        extraMCArgs: instance.mcOptions,
        launcherBrand: options?.launcherBrand ?? '',
        launcherName: options?.launcherName ?? 'XMCL',
        yggdrasilAgent: useAuthLib
          ? {
            jar: await this.externalAuthSkinService.installAuthLibInjection(),
            server: user.authService.hostName,
          }
          : undefined,
      }

      if (options?.server) {
        this.log('Launching a server')
        option.server = {
          ip: options.server.host,
          port: options.server?.port,
        }
      } else if ('server' in instance && instance.server?.host) {
        this.log('Launching a server')
        option.server = {
          ip: instance.server?.host,
          port: instance.server?.port,
        }
      }

      this.log('Launching with these option...')
      this.log(JSON.stringify(option, (k, v) => (k === 'accessToken' ? '***' : v), 2))

      try {
        const result = await this.javaService.validateJavaPath(javaPath)
        if (result === JavaValidation.NotExisted) {
          throw new LaunchException({ type: 'launchInvalidJavaPath', javaPath })
        }
        if (result === JavaValidation.NoPermission) {
          throw new LaunchException({ type: 'launchJavaNoPermission', javaPath })
        }
      } catch (e) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath }, 'Cannot launch without a valid java')
      }

      // Launch
      const process = await launch(option)
      this.launchedProcesses.push(process)
      process.on('spawn', () => {
        this.state.launchCount(this.state.activeCount + 1)
      }).on('close', () => {
        this.state.launchCount(this.state.activeCount - 1)
      })

      this.emit('minecraft-start', {
        pid: process.pid,
        version: version.id,
        minecraft: version.minecraftVersion,
        forge: instance.runtime.forge ?? '',
        fabricLoader: instance.runtime.fabricLoader ?? '',
      })
      const watcher = createMinecraftProcessWatcher(process)
      const errorLogs = [] as string[]

      process.stderr?.on('data', (buf: any) => {
        errorLogs.push(...buf.toString().split(EOL))
      })
      watcher.on('error', (err) => {
        this.emit('error', new LaunchException({ type: 'launchGeneralException', error: err }))
      }).on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation }) => {
        this.log(`Minecraft exit: ${code}, signal: ${signal}`)
        if (crashReportLocation) {
          crashReportLocation = crashReportLocation.substring(0, crashReportLocation.lastIndexOf('.txt') + 4)
        }
        this.emit('minecraft-exit', {
          pid: process.pid,
          code,
          signal,
          crashReport,
          crashReportLocation: crashReportLocation ? crashReportLocation.replace('\r\n', '').trim() : '',
          errorLog: errorLogs.join('\n'),
        })
        this.launchedProcesses = this.launchedProcesses.filter(p => p !== process)
      }).on('minecraft-window-ready', () => {
        this.emit('minecraft-window-ready', { pid: process.pid })
      })
      /* eslint-disable no-unused-expressions */
      process.stdout?.on('data', (s) => {
        const string = s.toString()
        this.emit('minecraft-stdout', { pid: process.pid, stdout: string })
      })
      process.stderr?.on('data', (s) => {
        this.warn(s.toString())
        this.emit('minecraft-stderr', { pid: process.pid, stderr: s.toString() })
      })
      process.unref()
      this.state.launchStatus('idle')

      return true
    } catch (e) {
      this.state.launchStatus('idle')
      if (e instanceof LaunchException) {
        throw e
      }
      this.error(e)
      throw new LaunchException({ type: 'launchGeneralException', error: e })
    }
  }
}
