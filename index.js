const EleventyJSONWatch = require('./lib/Eleventy');
const { extname } = require('path');
const path = require('path');
const os = require('os');

/**
 * Normalizes a path to remove any `.` and `..` segments to their POSIX equivalents.
 * Borrowed from Vite so this plugin doesn't need to depend on Vite
 * @param {string} id - The path to normalize.
 * @return {string} - The normalized path.
 **/
function normalizePath(id) {
  return path.posix.normalize(os.platform() === 'win32' ? id.replace(/\\/g, '/') : id);
}

/**
 * Vite plugin for Eleventy.
 * @param {Object} opts - The options for the plugin.
 * @param {Array.<string[]>} opts.replace - An array of arrays of strings representing path portions to be replaced when building Rollup output. First item should be find, second should be replace, assuming POSIX paths.
 * @return {Object} - The plugin object.
 **/
const eleventyPlugin = (opts = {}) => {
  let eleventy;
  let files = [];
  let output = [];
  const outIDs = [];
  const outFiles = [];
  let base;

  // Set up user options
  const options = Object.assign(
    {
      replace: [['/index.html', '']],
    },
    opts,
  );

  const contentTypes = {
    js: 'application/javascript',
    css: 'text/css',
    html: 'text/html',
    json: 'application/json',
  };

  return {
    name: 'eleventy',
    enforce: 'pre',

    // This _should_ be done in configResolved but we need to generate the HTML and the input files _before_ the config gets resolved. As a compromise, an error will be thrown in configResolved if the root changes.
    async config(config, { command }) {
      // Determine Vite's root. Because it can be an absolute or relative path, we're `path.resolve`ing it, then figuring out the relative path because that's what Eleventy needs.
      base = config.root ? path.resolve(config.root) : process.cwd();
      base = path.relative(process.cwd(), base) || '.';

      eleventy = new EleventyJSONWatch(base, base);
      await eleventy.init();
      files = await eleventy.toJSON();

      // On build, write files, glob the HTML, and add them to Build Rollup Options
      if (command === 'build') {
        // Add relative path to replacements for build files.
        if (base !== '.') {
          options.replace.unshift([base, '']);
        }

        // Determine output file object
        output = files.reduce((acc, cur) => {
          let name = cur.outputPath;
          // Removes all "replacements" from the output path to build name
          for (const r of options.replace) {
            name = name.replace(r[0], r[1]);
          }
          name = name.startsWith('/') ? name.substring(1) : name;

          cur.outId = path.join(process.cwd(), cur.outputPath);

          acc[name] = cur.outId;
          outIDs.push(cur.outId);
          outFiles.push(cur);
          return acc;
        }, {});

        // Return 11ty rollup inputs
        return {
          build: {
            rollupOptions: {
              input: output,
            },
          },
        };
      }
    },

    configResolved(resolvedConfig) {
      // If the root changes, throw an error
      const baseRoot = normalizePath(path.resolve(base));
      if (baseRoot !== normalizePath(resolvedConfig.root)) {
        throw new Error(
          'A plugin has changed the Vite root after [vite-plugin-eleventy] has run. Please make sure any plugins that change the Vite root run before this one.',
        );
      }
    },

    // Resolves IDs of files built by 11ty
    resolveId(id) {
      if (outIDs.includes(id)) {
        return id;
      }

      return null;
    },

    // Loads files built by 11ty
    load(id) {
      if (outIDs.includes(id)) {
        return outFiles.find((f) => f.outId === id).content;
      }
      return null;
    },

    // Configures dev server to respond with virtual 11ty output
    configureServer(server) {
      // Set up 11ty watcher and reload.
      eleventy.watch();
      eleventy.config.events.on('watchChange', (f) => {
        files = f;
        if (server.ws) {
          server.ws.send({
            type: 'full-reload',
            event: 'eleventy-update',
            data: {},
          });
        }
      });

      // Setup Vite dev server middlware to respond with virtual 11ty output
      server.middlewares.use(async (req, res, next) => {
        // Need to grab the pathname, not the request url, to match against 11ty output
        const { pathname } = req._parsedUrl;
        const url = pathname.endsWith('/') ? pathname : `${pathname}/`;

        // Find the file if it exists!
        const output = files.find((r) => r.url === url);
        if (output) {
          let ct = '';

          // Manage transforms and content types
          if ((extname(url) === '' && url.endsWith('/')) || extname(url) === '.html') {
            // If it's an HTML file or a route, run it through transformIndexHtml
            output.content = await server.transformIndexHtml(url, output.content, req.originalUrl);
            ct = 'html';
          } else {
            // Otherwise, run it through transformRequest
            output.content = await server.transformRequest(url, output.content, req.originalUrl);
            ct = extname(url).replace('.', '');
          }

          return res
            .writeHead(200, {
              'Content-Length': Buffer.byteLength(output.content),
              'Content-Type': contentTypes[ct] || 'text/plain',
            })
            .end(output.content);
        }

        return next();
      });
    },
  };
};

module.exports = {
  eleventyPlugin,
};
