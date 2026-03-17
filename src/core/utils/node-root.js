const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * 辅助函数：安全执行 shell 命令（避免执行失败导致程序崩溃）
 * @param {string} cmd 要执行的命令
 * @returns {string|null} 命令输出结果（失败返回 null）
 */
function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (err) {
    return null;
  }
}

/**
 * 辅助函数：解析路径（处理软链/快捷方式，验证路径存在性）
 * @param {string} targetPath 待解析的路径
 * @returns {string|null} 真实存在的路径（失败返回 null）
 */
function resolveValidPath(targetPath) {
  if (!targetPath) return null;
  try {
    // 解析软链/快捷方式的真实物理路径
    const realPath = fs.realpathSync(targetPath);
    // 验证路径是否存在
    return fs.existsSync(realPath) ? realPath : null;
  } catch (err) {
    return null;
  }
}

/**
 * 从 NVM 环境中获取全局 node_modules 路径
 * @returns {string|null} NVM 环境下的真实路径
 */
function getNvmGlobalPath() {
  // 1. 获取 NVM 根目录（优先读环境变量）
  const nvmDir = process.env.NVM_DIR || (
    process.platform === 'win32'
      ? path.join(process.env.USERPROFILE, '.nvm')
      : path.join(process.env.HOME, '.nvm')
  );

  // 2. 获取当前激活的 Node 版本
  const nodeVersion = safeExec('nvm current');
  if (!nodeVersion || nodeVersion.includes('N/A')) return null;

  // 3. 拼接 NVM 下的全局 node_modules 路径
  const nvmGlobalPath = path.join(
    nvmDir,
    'versions',
    'node',
    nodeVersion,
    'lib',
    'node_modules'
  );

  // 4. 解析并验证路径有效性
  return resolveValidPath(nvmGlobalPath);
}

/**
 * 从 NPM 命令获取全局 node_modules 路径
 * @returns {string|null} NPM 返回的真实路径
 */
function getNpmGlobalPath() {
  // 1. 执行 npm root -g 获取路径
  const npmPath = safeExec('npm root -g');
  // 2. 解析并验证路径有效性
  return resolveValidPath(npmPath);
}

/**
 * 兜底方案：通过 Node 内置变量计算全局路径
 * @returns {string|null} 计算出的路径（仅作为最后兜底）
 */
function getFallbackGlobalPath() {
  try {
    const nodeExecPath = process.execPath;
    let globalPrefix;

    if (process.platform === 'win32') {
      // Windows：node.exe 所在目录的上一级
      globalPrefix = path.dirname(path.dirname(nodeExecPath));
    } else {
      // Mac/Linux：node 所在目录的上两级
      globalPrefix = path.dirname(path.dirname(path.dirname(nodeExecPath)));
    }

    const fallbackPath = path.join(globalPrefix, 'lib', 'node_modules');
    return resolveValidPath(fallbackPath);
  } catch (err) {
    return null;
  }
}

/**
 * 主函数：获取最正确的全局 node_modules 路径（自动适配所有场景）
 * 优先级：NVM 路径 → NPM 命令路径 → 兜底计算路径
 * @returns {string|null} 最准确的全局 node_modules 路径
 */
function getGlobalNodeModulesPath() {
  // 优先级 1：优先获取 NVM 环境下的路径（适配 NVM 场景）
  const nvmPath = getNvmGlobalPath();
  if (nvmPath) {
    return nvmPath;
  }

  // 优先级 2：通过 npm 命令获取（普通环境最准确）
  const npmPath = getNpmGlobalPath();
  if (npmPath) {
    return npmPath;
  }

  // 优先级 3：兜底计算（仅当以上都失败时使用）
  const fallbackPath = getFallbackGlobalPath();
  if (fallbackPath) {
    return fallbackPath;
  }

  // 所有方案都失败
  console.error('无法获取全局 node_modules 路径');
  return null;
}

// 导出所有函数（方便单独使用），主函数作为默认导出
module.exports = {
  safeExec,
  resolveValidPath,
  getNvmGlobalPath,
  getNpmGlobalPath,
  getFallbackGlobalPath,
  getGlobalNodeModulesPath // 主函数
};

// 默认导出主函数（简化使用）
module.exports.default = getGlobalNodeModulesPath;