# deepfish Copilot 配置指南

本文档用于说明如何在 deepfish 中配置 Copilot（GitHub Models 网关），并解释 OAuth App Client ID、Client Secret、Scope 的获取方式。

## 一、前提

- 你需要一个 GitHub 账号。
- deepfish 项目已安装依赖，可执行 CLI 命令。
- 当前项目的 Copilot 类型使用 GitHub Models 网关：
  - baseUrl: https://models.github.ai/inference
  - type: github-models

## 二、OAuth 参数分别是什么

### 1) OAuth App Client ID

- 含义：OAuth 应用的公开标识。
- 用途：Device Flow 发起登录时用于标识你的应用。
- 获取：在 GitHub OAuth App 详情页直接可见。

### 2) OAuth App Client Secret

- 含义：OAuth 应用的私密凭证。
- 用途：部分场景用于换取或刷新短期 token。
- 获取：在 OAuth App 详情页点击生成。
- 注意：只会完整显示一次，请妥善保存。

### 3) OAuth Scope

- 含义：申请的权限范围。
- 推荐值：models:read
- 说明：调用 GitHub Models 推理一般使用最小权限 models:read 即可。

## 三、如何创建 GitHub OAuth App

1. 打开 GitHub，进入 Settings。
2. 进入 Developer settings。
3. 打开 OAuth Apps，点击 New OAuth App。
4. 按如下建议填写：
   - Application name: 例如 deepfish-ai
   - Homepage URL: 例如 http://localhost
   - Authorization callback URL: 例如 http://localhost
5. 提交后进入应用详情页：
   - 复制 Client ID
   - 生成并保存 Client Secret

## 四、必须开启 Device Flow（关键）

如果未开启，会报错：

Failed to request GitHub device code: Device Flow must be explicitly enabled for this App
Copilot login failed. Configuration was not added.

处理方法：

1. 进入该 OAuth App 的设置页。
2. 勾选 Enable Device Flow。
3. 点击 Update application 保存。
4. 重新执行配置或登录命令。

## 五、在 deepfish 中配置 Copilot

当前实现已支持在 config add 里自动触发 GitHub Device Login。

步骤：

1. 执行命令：node src/cli/index.js config add
2. 选择 Type 为 Copilot。
3. 按提示输入：
   - Client ID
   - Client Secret（可留空，但建议填写，便于刷新）
   - Scope（建议 models:read）
4. CLI 会显示浏览器验证地址和用户验证码。
5. 在浏览器完成授权后，CLI 自动轮询拿到短期 token 并写入配置。

说明：

- 选择 Copilot 时，会跳过 baseUrl 与 apiKey 手工输入。
- 认证成功后自动写入 apiKey 与 githubAuth。
- token 过期后会尝试自动刷新；若无 refresh token，则需要重新登录。

## 六、单独执行登录（已有配置时）

如果你已经有一个 github-models 类型配置，可单独执行：

- node src/cli/index.js auth github-login 配置名

不传配置名时，默认使用 currentAi。

## 七、常见问题排查

### 1) Device Flow must be explicitly enabled for this App

- 原因：OAuth App 未启用 Device Flow。
- 处理：按第四节开启 Enable Device Flow。

### 2) 401 Unauthorized

常见原因：

- apiKey 为空或无效。
- 账号未授权成功。
- 模型名称不可用或写错。
- token 已过期且无法刷新。

建议排查：

1. 先执行一次 auth github-login 重新登录。
2. 查看当前配置是否为 github-models。
3. 检查 model 名称是否为 GitHub Models 支持的模型。

### 3) 没有 refresh token

- 现象：token 到期后无法自动刷新。
- 处理：重新执行 github-login 获取新 token。

## 八、当前项目相关代码位置

- Copilot 默认项定义：src/cli/DefaultConfig.js
- 配置命令与自动登录入口：src/cli/ai-config.js
- GitHub Device Flow 登录实现：src/cli/ai-auth.js
- 请求前自动刷新 token：src/AgentRobot/BaseAgentRobot/utils/AIRequest.js

