# dsh-habits

[English](README.md) | 中文

一个 DeepSeek Harness (DSH) 插件，在 Web 设置 → 通用设置中新增「我的习惯」编辑器。你保存的文字会写入用户全局指令文档 `$DSH_HOME/AGENTS.md`，而内置的 `dsh-agent-instructions` 加载器已经会把该文件注入到每个会话——因此你的偏好和习惯会自动到达模型。

不修改任何 DSH 核心：host 半部分在 `ctx.webServer` 上注册一个小型 REST 面（`/api2/habits/describe` + `/api2/habits/update`），browser 半部分注册一个 `settings.general.item` 行去调用它。这与 `dsh-web-plugin-manager` 用的是同一套独立 bundle 模式。

## 安装

```bash
dsh plugin add --profile web github:<owner>/dsh-habits
```

然后重启 `web` profile（`dsh --profile web`）让 bundle 层加载。打开 **设置 → 通用设置 → 我的习惯**，写入你的说明并保存。新会话立即生效；运行中的会话在下一次文件触达或恢复时刷新。

## 工作原理

| 层 | 机制 |
|---|---|
| Host 半部分 | `ctx.inject(['webServer'])` → `ctx.webServer.register()` 注册 `describe`/`update` |
| 读取 | `readFileSync($DSH_HOME/AGENTS.md)`；缺失即空白文档，不报错 |
| 写入 | 原子 rename，65 536 字节预算内，用 SHA-1 `expectedRevision` 拒绝并发覆盖 |
| Browser 半部分 | `settings.general.item` 槽（id `habits`），`fetch` 调用 REST 面 |
| 注入 | 内置 `dsh-agent-instructions` 加载器把 `~/.dsh/AGENTS.md` 注入为工作区指令基线 |

## 构建

```bash
pnpm install
pnpm run build
```

`build` = host `tsc` + client `tsc`（类型声明）+ `tsdown`（`__ModuleLoader__.load` 客户端 bundle）。

## 已知限制

- **对新会话生效**——`dsh-agent-instructions` 在下一次成功的 `read`/`write`/`edit` 触达、恢复会话，或阴影基线重新进入时刷新；对话中途的保存不会立刻重写正在运行的会话。
- **一个编辑器拥有该文档**——并发编辑通过 `expectedRevision` 冲突拒绝来仲裁，而非合并。
