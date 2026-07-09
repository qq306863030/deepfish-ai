# 黑色窗口闪烁修复

## 根因

`src/cli/cli-utils/node-root.ts` 在模块加载时用 `execSync` 执行 `nvm current` 和 `npm root -g`，每次 `execSync` 都会在 Windows 上创建一个控制台窗口。

## 调试过程

通过二分法逐步屏蔽 `pm2-server.ts` 的 import 链定位：

1. 最小化入口（只用 `http.createServer`）→ 无黑窗 ✅
2. 加回 `startServer`（Express + SSR）→ 无黑窗 ✅
3. 加回 `startAgentRoomServer` → 有黑窗 ❌

进一步追踪 `server.ts` 的 import 链：`server.ts` → `getGlobalPath.ts` → `node-root.ts` → `execSync('nvm current')` + `execSync('npm root -g')` → **Windows 弹窗**

## 核心修复

**文件：`src/cli/cli-utils/node-root.ts`**

删除所有 `execSync` 调用，只保留 `process.execPath` 计算路径：

```typescript
const path = require('path')
const fs = require('fs')

function resolveValidPath(targetPath: string) {
  if (!targetPath) return null
  try {
    const realPath = fs.realpathSync(targetPath)
    return fs.existsSync(realPath) ? realPath : null
  } catch {
    return null
  }
}

function getGlobalNodeModulesPath() {
  try {
    const nodeExecPath = process.execPath
    let globalPrefix: string
    if (process.platform === 'win32') {
      globalPrefix = path.dirname(path.dirname(nodeExecPath))
    } else {
      globalPrefix = path.dirname(path.dirname(path.dirname(nodeExecPath)))
    }
    return resolveValidPath(path.join(globalPrefix, 'lib', 'node_modules'))
  } catch {
    return null
  }
}

export default getGlobalNodeModulesPath
```

**文件：`src/cli/cli-utils/getGlobalPath.ts`**

`getScanDirPaths` 中加空值保护：

```typescript
const nodeRootBase = getGlobalNodeModulesPath();
if (nodeRootBase) {
  const nodeRoot = path.join(nodeRootBase, '@deepfish-ai')
  if (fs.existsSync(nodeRoot)) {
    paths.add(nodeRoot)
  }
}
```
