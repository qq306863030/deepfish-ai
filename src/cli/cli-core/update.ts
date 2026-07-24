import { spawnSync } from 'child_process';
import { logInfo, logSuccess, logError } from '../../utils/print';
import { getVersion } from '../cli-utils/getGlobalData';

const PKG_NAME = 'deepfish-ai';

export async function handleUpdate() {
  try {
    logInfo('正在检查最新版本...');

    // 获取本地版本
    const localVersion = getVersion();
    logInfo(`当前版本: v${localVersion}`);

    // 查询 npm 最新版本
    const result = spawnSync('npm', ['view', PKG_NAME, 'version'], {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
    });

    if (result.error || result.status !== 0) {
      logError(`检查版本失败: ${result.stderr?.trim() || result.error?.message || '未知错误'}`);
      return;
    }

    const latestVersion = result.stdout.trim();
    logInfo(`最新版本: v${latestVersion}`);

    // 比较版本
    if (localVersion === latestVersion) {
      logSuccess(`已是最新版本 v${localVersion}，无需更新`);
      return;
    }

    logInfo(`发现新版本 v${latestVersion}，开始更新...`);

    // 执行全局更新
    const installResult = spawnSync('npm', ['install', '-g', `${PKG_NAME}@latest`], {
      encoding: 'utf8',
      stdio: 'inherit',
      windowsHide: true,
    });

    if (installResult.error || installResult.status !== 0) {
      logError(`更新失败: ${installResult.stderr?.trim() || installResult.error?.message || '未知错误'}`);
      return;
    }

    logSuccess(`更新成功！已从 v${localVersion} 升级到 v${latestVersion}`);
    logInfo('请重启终端或重新执行命令以使更新生效');
  } catch (err) {
    logError(`更新过程出错: ${err instanceof Error ? err.message : String(err)}`);
  }
}
