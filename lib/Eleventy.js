const Eleventy = require('@11ty/eleventy');
const EleventyBaseError = require('@11ty/eleventy/src/EleventyBaseError');
const chalk = require('chalk');

/**
 * Extension of Eleventy to allow for JSON watching
 */
class EleventyJSONWatch extends Eleventy {
  /**
   *
   * @param {string} input Input directory
   * @param {string} output Output directory
   * @param {object} options Options object
   * @param {object} eleventyConfig Eleventy config
   */
  constructor(input, output, options = {}, eleventyConfig = null) {
    super(input, output, options, eleventyConfig);
  }

  /**
   *
   * @param {string} msg Message to log
   * @param {string} file File path
   * @param {string} type One of 'info', 'warn', or 'error'
   */
  viteLog(msg, file, type) {
    const prefix = '[vite-plugin-eleventy]';

    const tag =
      type === 'info'
        ? chalk.cyan.bold(prefix)
        : type === 'warn'
        ? chalk.yellow.bold(prefix)
        : chalk.red.bold(prefix);

    this.logger.forceLog(
      `${chalk.dim(new Date().toLocaleTimeString())} ${tag} ${chalk.green(msg)} ${chalk.dim(file)}`,
    );
  }

  /**
   * Start the watching of files.
   *
   * @async
   * @method
   */
  async watch() {
    this.watcherBench.setMinimumThresholdMs(500);
    this.watcherBench.reset();

    // We use a string module name and try/catch here to hide this from the zisi and esbuild serverless bundlers
    let chokidar;
    // eslint-disable-next-line no-useless-catch
    try {
      const moduleName = 'chokidar';
      chokidar = require(moduleName);
    } catch (e) {
      throw e;
    }

    // Note that watching indirectly depends on this for fetching dependencies from JS files
    // See: TemplateWriter:pathCache and EleventyWatchTargets
    const result = await this.toJSON();
    if (result.error) {
      // initial build failed—quit watch early
      return Promise.reject(result.error);
    }

    const initWatchBench = this.watcherBench.get('Start up --watch');
    initWatchBench.before();

    await this.initWatch();

    // TODO improve unwatching if JS dependencies are removed (or files are deleted)
    const rawFiles = await this.getWatchedFiles();
    if (process.env.DEBUG === 'Eleventy') {
      this.viteLog('Watching for changes to: %o', rawFiles);
    }

    const watcher = chokidar.watch(rawFiles, this.getChokidarConfig());

    initWatchBench.after();

    this.watcherBench.finish('Watch');

    this.watcher = watcher;

    let watchDelay;
    const watchRun = async (path) => {
      try {
        this._addFileToWatchQueue(path);
        clearTimeout(watchDelay);

        await new Promise((resolve, reject) => {
          watchDelay = setTimeout(async () => {
            this._watch().then(resolve, reject);
          }, this.config.watchThrottleWaitTime);
        });
      } catch (e) {
        if (e instanceof EleventyBaseError) {
          this.errorHandler.error(e, 'Eleventy watch error');
          this.watchManager.setBuildFinished();
        } else {
          this.errorHandler.fatal(e, 'Eleventy fatal watch error');
          this.stopWatch();
        }
      }
    };

    watcher.on('change', async (path) => {
      this.viteLog('file changed', path, 'info');
      this.viteLog('running 11ty', '', 'info');
      await watchRun(path);
    });

    watcher.on('add', async (path) => {
      this.viteLog('file added', path, 'info');
      this.viteLog('running 11ty', '', 'info');
      await watchRun(path);
    });

    process.on('SIGINT', () => this.stopWatch());
  }

  /**
   * tbd.
   *
   * @private
   * @method
   */
  async _watch() {
    if (this.watchManager.isBuildRunning()) {
      return;
    }

    this.watchManager.setBuildRunning();

    const queue = this.watchManager.getActiveQueue();
    await this.config.events.emit('beforeWatch', queue);
    await this.config.events.emit('eleventy.beforeWatch', queue);

    // reset and reload global configuration :O
    if (this.watchManager.hasQueuedFile(this.eleventyConfig.getLocalProjectConfigFile())) {
      this.resetConfig();
    }

    await this.restart();

    this.watchTargets.clearDependencyRequireCache();

    const incrementalFile = this.watchManager.getIncrementalFile();
    if (incrementalFile) {
      this.writer.setIncrementalFile(incrementalFile);
    }

    await this.config.events.emit('watchChange', await this.toJSON());
    // let writeResult = await this.write();
    // let hasError = !!writeResult.error;

    this.writer.resetIncrementalFile();

    this.watchTargets.reset();

    await this._initWatchDependencies();

    // Add new deps to chokidar
    this.watcher.add(this.watchTargets.getNewTargetsSinceLastReset());

    this.watchManager.setBuildFinished();

    if (this.watchManager.getPendingQueueSize() > 0) {
      this.viteLog(
        'file saved while 11ty running',
        `${this.watchManager.getPendingQueueSize()} files in queue`,
        'warn',
      );
      await this._watch();
    }
  }
}

module.exports = EleventyJSONWatch;
