# Vite Plugin Eleventy

Vite plugin to build out your site with [Eleventy](http://11ty.io/). Allows you to use the power of 11ty to build your HTML without needing to compile it to disk during development.

## THIS IS SUPER ALPHA SOFTWARE

This is more of a proof of concept than something you should rely on for production. It requires the canary build of 11ty and I can't guarantee it'll work with all 11ty setups and plugins. It also **won't** work with HTML files, at all. Don't use HTML files, either hand-written or with 11ty, with this plugin. If you're writing Nunjucks, use `.njk`, not `.html`, for instance. Don't rely on 11ty's default template handling for HTML files is what I'm saying.

Don't expect something resembling a stable release until at least Eleventy 1.0 is released.

## Usage

After installing, add it to your Vite config as follows:

```js
const { eleventyPlugin } = require('vite-plugin-eleventy');

module.exports = {
  plugins: [eleventyPlugin()],
};
```

Then, include the following JavaScript on any page you want to automatically reload when an Eleventy generated file is changed (like in a `type="module"` script block):

```js
if (import.meta.hot) {
  import.meta.hot.on('eleventy-update', () => {});
}
```

## Config

The following options are available for configuration; pass them in as an object when instantiating the plugin:

- `glob` - The glob string or array of globs to use for Eleventy generated files. Matched files will be added to Vite's `rollupOptions.input` and deleted when building using Vite. Any valid [fast glob](https://www.npmjs.com/package/fast-glob) pattern will work here. Defaults to `viteConfig.root + '/**/*.html'`
- `replace` - Array of arrays representing replacements to be made to a glob'd path to generate an input name for Rollup. Internal arrays are in the form of `[find, replace]`. Will be passed to `string.replace`. Defaults to `[[viteConfig.root, ''], ['/index.html', '']]`

## Important Eleventy differences

- This plugin overrides Eleventy's input and output directories with Vite's root directory configuration. If you want to change where files live, you need to change Vite's root. This also means your 11ty template and include directories are relative to the Vite root. This also means you need to _not_ rely on Vite plugins to set your project root.
- There is no output 11ty during development. During a production build, 11ty generated files will be put into your Vite root directory, then cleaned up once the build is done. For this stage, **only HTML output is supported**. I know 11ty can output different kinds of files, and maybe that'll be a future enhancement, but for now, only HTML output is supported.
