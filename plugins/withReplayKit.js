const { withXcodeProject } = require('@expo/config-plugins');

const withReplayKit = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const targetUuid = xcodeProject.getFirstTarget().uuid;
    
    // On dit à Xcode d'ajouter le framework système "ReplayKit"
    xcodeProject.addFramework('ReplayKit.framework', { target: targetUuid });
    
    return config;
  });
};

module.exports = withReplayKit;