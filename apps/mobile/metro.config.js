// Metro configuration for the PersonBrief app.
//
// The app shares pure code with the website (packages/shared) and reuses its
// message catalogues (messages/*.json) and brand fonts (assets/fonts). Those
// live outside this folder, so Metro watches them, and any package they import
// (zod) is resolved from this app's node_modules — never from the website's.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const sharedRoot = path.join(repoRoot, "packages/shared/src");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot, path.join(repoRoot, "messages"), path.join(repoRoot, "assets/fonts")];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];

const ALIASES = {
  "@personbrief/shared/": sharedRoot + path.sep,
  "@personbrief/messages/": path.join(repoRoot, "messages") + path.sep,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [prefix, target] of Object.entries(ALIASES)) {
    if (moduleName.startsWith(prefix)) return context.resolveRequest(context, target + moduleName.slice(prefix.length), platform);
  }
  const fromShared = context.originModulePath.startsWith(sharedRoot);
  if (fromShared && !moduleName.startsWith(".") && !path.isAbsolute(moduleName)) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, "package.json") }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
