const EleventyJSONWatch = require('./lib/Eleventy');
const glob = require('fast-glob');
const del = require('del');
const deleteEmpty = require('delete-empty');
const path = require('path');

const eleventyPlugin = (opts = {}) => {
  let config;
  let eleventy;
  let files = [];
  let formats = [];

  return {
    name: 'eleventy',
    enforce: 'pre',

    async config(config, { command }) {
      // This _should_ be done in configResolved but we need to generate the HTML and the input files _before_ the config gets resolved.
      eleventy = new EleventyJSONWatch(config.root, config.root);
      await eleventy.init();

      // Save formats for HMR later, but drop .html support
      formats = eleventy.config.templateFormats.filter((f) => f !== 'html');

      // On serve, set up watcher
      if (command === 'serve') {
        files = await eleventy.toJSON();
        eleventy.watch();

        eleventy.config.events.on('watchChange', (f) => {
          files = f;
        });
      }

      // On build, write files, glob the HTML, and add them to Build Rollup Options
      if (command === 'build') {
        await eleventy.write();

        // Set up options!
        const options = Object.assign(
          {
            glob: config.root + '/**/*.html',
            replace: [
              [config.root, ''],
              ['/index.html', ''],
            ],
          },
          opts,
        );

        files = glob.sync(options.glob).reduce((acc, cur) => {
          let name = cur;

          for (const r of options.replace) {
            name = name.replace(r[0], r[1]);
          }

          name = name.startsWith('/') ? name.substring(1) : name;

          acc[name] = cur;
          return acc;
        }, {});

        return {
          build: {
            rollupOptions: {
              input: files,
            },
          },
        };
      }
    },

    // Stores
    async configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    // Clean up the compiled files and empty directories after stuff gets compiled
    async closeBundle() {
      await del(Object.values(files));
      await deleteEmpty(config.root);
    },

    // Sends 11ty update HMR signal
    handleHotUpdate({ file, server }) {
      if (formats.includes(path.extname(file).substring(1))) {
        eleventy.config.events.on('watchChange', (f) => {
          server.ws.send({
            type: 'custom',
            event: 'eleventy-update',
            data: {},
          });
        });

        return [];
      }
    },

    // Configures dev server to respond with virtual 11ty output
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Need to grab the pathname, not the request url, to match against 11ty output
        const { pathname } = req._parsedUrl;
        const url = pathname.endsWith('/') ? pathname : `${pathname}/`;

        // Find the file if it exists!
        const output = files.find((r) => r.url === url);
        if (output) {
          return res.end(output.content);
        }

        return next();
      });
    },
  };
};

module.exports = {
  eleventyPlugin,
};
