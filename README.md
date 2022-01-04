# Vite Plugin Eleventy

Vite plugin to build out your site with [Eleventy](http://11ty.io/). Allows you to use the power of 11ty to build your HTML without needing to compile it to disk during development.

## This is Beta software

This plugin relies on Eleventy 1.0, which is currently in beta. If you're experiencing issues, please make sure it works on the latest Eleventy beta first. A stable release of this plugin isn't likely until Eleventy 1.0 is fully released.

Due to the nature of integrating Vite with Eleventy, not all Eleventy setups and plugins are guaranteed to work; when in doubt, consider moving to Vite plugins from Eleventy plugins (for instance, instead of using Eleventy [transforms](https://www.11ty.dev/docs/config/#transforms), consider writing/using a [PostHTML](https://github.com/posthtml/posthtml) plugin with [Vite Plugin PostHTML](https://www.npmjs.com/package/vite-plugin-posthtml)).

Finally, because Vite has built-in handling for HTML files, it's recommended to _not_ use `.html` files with Eleventy. If you're writing Nunjucks, for instance, use `.njk` instead of `.html`. Don't rely on Eleventy's default template handling for HTML files is what I'm saying.

## Usage

After installing, add it to your Vite config as follows:

```js
const { eleventyPlugin } = require('vite-plugin-eleventy');

module.exports = {
  plugins: [eleventyPlugin()],
};
```

## Config

The following options are available for configuration; pass them in as an object when instantiating the plugin:

- `replace` - Array of arrays representing replacements to be made to a glob'd path to generate an input name for Rollup. Internal arrays are in the form of `[find, replace]`. Will be passed to `string.replace`. Defaults to `[[viteConfig.root, ''], ['/index.html', '']]`

## Important Eleventy differences

- This plugin overrides Eleventy's input and output directories with Vite's root directory configuration. If you want to change where files live, you need to change Vite's root. This also means your 11ty template and include directories are relative to the Vite root. This also means you need to _not_ rely on Vite plugins to set your project root. Further testing will determine if this changes in the future.
