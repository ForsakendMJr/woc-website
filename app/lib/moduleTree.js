const defaultModules = buildDefaultModulesFromTree(MODULE_TREE);

const modulesMissing =
  !settings.modules ||
  typeof settings.modules !== "object" ||
  Object.keys(settings.modules).length === 0;

if (modulesMissing) {
  settings.modules = defaultModules;
  await settings.save();
} else {
  const merged = mergeModuleDefaults(settings.modules, defaultModules);

  // only save if it actually changed
  const before = JSON.stringify(settings.modules);
  const after = JSON.stringify(merged);

  if (before !== after) {
    settings.modules = merged;
    await settings.save();
  }
}
