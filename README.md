# 番茄小说下载器 · 多租户 Web 平台

把上游单机版下载器升级成「一台服务器服务多用户」的网站系统。
基于 **FastAPI + SQLite + nginx**，为每个注册用户分配独立子域名、独立端口、独立实例。

---

## ⚠️ 关于解析与下载（请先看）

**本仓库只包含 Web 外壳，不包含任何解析、抓取、下载、格式转换逻辑。**

| 本仓库负责 | 上游负责 |
|-----------|---------|
| 注册 / 登录 / 邮箱验证 / 会话 | **小说站点解析** |
| 多租户子域名与反向代理 | **章节抓取与并发下载** |
| 实例的启动 / 探活 / 空闲回收 | **EPUB / TXT / 格式导出** |
| 管理后台、公告、配额 | **版本迭代与规则维护** |
| 用户空间与文件管理 | **二进制本体** |

真正的下载能力来自上游项目：

> **https://github.com/zhongbai2333/Tomato-Novel-Downloader**

部署时由 `install.sh` 从上游 **Release** 拉取官方二进制，本平台以**子进程**方式
为每个用户拉起一份独立实例（每个实例有独立端口、独立工作目录、独立配置）。

因此：

- 解析规则失效、站点改版、格式问题 → **请到上游仓库反馈**，本仓库无法修复
- 想升级下载内核 → 后台「🔄 番茄版本管理」一键替换二进制，或重新跑 `install.sh`
- 上游作者的功劳请不要忘记，本项目只是给它套了层多租户的壳

---

## 架构

```
                         ┌──────────────────────────────────────────┐
   用户浏览器             │              同一台服务器                  │
                         │                                          │
  https://tomato.域名 ───┼─> nginx :443 ─> 网关 FastAPI :18080       │
   (主站/注册/登录)       │     │            ├─ 注册 / 登录 / 我的空间   │
                         │     │            ├─ 管理后台 /linjiuser      │
                         │     │            ├─ 用户空间文件 API         │
                         │     │            └─ 审计 / 公告 / 版本管理   │
                         │     │                                     │
  https://u5.域名 ───────┼─> nginx ──auth_request──> 网关校验 cookie   │
   (用户个人下载空间)      │     │                                     │
                         │     └─> 该用户的番茄实例 127.0.0.1:19004    │
                         │            （上游二进制，懒启动，空闲 20 分钟回收）
                         └──────────────────────────────────────────┘
```

### 分配规则（确定性绑定）

| 项 | 规则 |
|----|------|
| 子域名 | `u<N>`（N 为自增编号） |
| 端口 | `19000 + (N - 1)` |
| 数据目录 | `/opt/tomato-multi/data/users/u<N>` |

三者由数据库统一计算，**不会漂移**。

---

## 目录

```
.
├── app/
│   ├── main.py            # FastAPI 网关：鉴权 / 用户 API / 管理后台 API / 页面路由
│   ├── db.py              # SQLite 数据层（用户、会话、密码版本、邮箱验证码）
│   ├── instances.py       # 实例管理：启动 / 探活 / 空闲回收 / 清理 / 生成 nginx 配置
│   ├── static/
│   │   ├── index.html     # 主站（注册/登录/我的空间）
│   │   └── announce.js    # 全站公告弹窗脚本（由 nginx sub_filter 注入）
│   └── adminstatic/
│       ├── admin.html     # 管理后台面板
│       └── login.html     # 后台专用登录页
├── deploy/
│   ├── tomato-gateway.service   # systemd 单元
│   ├── nginx-main.conf          # 主站 nginx 配置
│   ├── nginx-block.conf         # IP/未知域名兜底（444 掐断）
│   └── reload-nginx.sh          # 重新生成用户子域配置并 reload
├── install.sh             # 一键部署脚本
├── .env.example           # 配置模板
└── README.md
```

---

## 快速部署

### 前置条件

- 一台 Linux 服务器（Debian/Ubuntu 系），root 权限
- 一个域名，DNS 可添加 `tomato` 与 `*.tomato` 两条 A 记录（指向本机 IP）
- 开放 80 / 443 端口
- 服务器能访问 GitHub（用于拉取上游二进制）

### 一键安装

```bash
git clone https://github.com/yujunc39-arch/Tomato-Web.git
cd Tomato-Web
cp .env.example .env
vi .env                       # 至少改 TOMATO_DOMAIN
sudo bash install.sh
```

安装完成后：

| 入口 | 地址 |
|------|------|
| 主站（用户注册/登录） | `https://tomato.你的域名` |
| 管理后台 | `https://tomato.你的域名/linjiuser` |
| 用户空间 | `https://u1.你的域名`… |

---

## 配置项（`.env`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `TOMATO_DOMAIN` | ✅ | 主域名，例如 `tomato.example.com`。子域名会是 `u1.tomato.example.com` |
| `TOMATO_SECRET` | ⬜ | JWT 密钥。留空则安装时自动生成随机值 |
| `TOMATO_CERT` / `TOMATO_CERTKEY` | ⬜ | 证书路径，默认 `/etc/letsencrypt/live/<DOMAIN>/…` |
| `ADMIN_ROLE_ENABLED` | ⬜ | `1`=普通管理员可用后台；`0`（默认）=管理员权能暂停，后台仅超管可进 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | ⬜ | 邮箱验证发信（Resend / 任意 SMTP）。留空则跳过邮箱验证 |
| `DAILY_REG_LIMIT` | ⬜ | 每日注册上限（默认 100） |
| `RESEND_API_KEY` | ⬜ | 用 Resend 收发信时填，用于读取当日额度 |
| `EMAIL_ALLOWED_DOMAINS` | ⬜ | 邮箱域名白名单，默认 `qq.com,163.com,gmail.com` |
| `TURNSTILE_SITEKEY` / `TURNSTILE_SECRET` | ⬜ | Cloudflare Turnstile 真人校验。**留空 = 功能关闭** |

`.env` 权限应为 `600`，`systemd` 通过 `EnvironmentFile` 加载。

---

## 后端 API 概览

### 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register/send_code` | 发送邮箱验证码 |
| POST | `/api/register` | 注册（需邮箱 + 验证码，受每日名额限制） |
| POST | `/api/login` | 登录（支持用户名或邮箱，下发跨子域 `token` cookie） |
| POST | `/api/admin/login` | **管理后台专用登录**：仅管理员账号可过，沿用登录限流 |
| POST | `/api/logout` | 退出（吊销当前会话） |
| GET | `/api/me` | 当前用户信息 + 实例状态 |
| POST | `/api/me/start` | 启动个人实例 |
| POST | `/api/me/change_password` | 修改密码 |
| GET | `/api/auth_check` | 供 nginx `auth_request` 子请求鉴权 |
| GET | `/api/site_info` | 站点信息（域名 / 注册名额剩余） |
| GET | `/__announce__` | 公开读取当前公告 |

### 管理（需管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表（含磁盘用量 / 运行状态 / 书籍数 / 邮箱） |
| POST | `/api/admin/register` | 新增用户（仅超管） |
| POST | `/api/admin/users/{uid}/ban` `/unban` `/delete` | 封禁 / 解封 / 删除 |
| POST | `/api/admin/users/{uid}/start` `/stop` | 开关实例 |
| POST | `/api/admin/stop_all` | 一键关闭所有实例（仅超管） |
| POST | `/api/admin/users/{uid}/set_password` | 重置密码（仅超管） |
| POST | `/api/admin/users/{uid}/set_email` | 补填 / 修改邮箱 |
| POST | `/api/admin/users/{uid}/admin` | 设置/取消管理员（仅超管） |
| GET | `/api/admin/user_files/{uid}` | 浏览用户空间 |
| GET | `/api/admin/users/{uid}/download` | 下载文件（文件夹自动打包 zip） |
| POST | `/api/admin/users/{uid}/delete_path` | 删除文件 / 文件夹 |
| GET/POST | `/api/admin/users/{uid}/file` | 读取 / 保存 `config.yml`（带语法校验 + `.bak` 备份） |
| GET | `/api/admin/downloads` | 软件下载统计 |
| GET | `/api/admin/announce` · POST `/api/admin/announce` `/announce/clear` | 公告读写 |
| GET | `/api/admin/tomato_version` | 当前版本 vs 上游最新版本 |
| POST | `/api/admin/tomato_update` | 从上游下载并替换番茄二进制（仅超管） |

---

## 权限模型

```
👑 超级管理员 (is_super)
   ├─ 增删所有用户（含其他管理员）
   ├─ 设置 / 取消管理员
   ├─ 封禁 / 解封 / 删除任意用户
   ├─ 重置任意用户密码、一键关闭所有实例、发布公告
   ├─ 番茄版本管理（升级下载内核）
   └─ 不能封禁 / 删除 / 降级自己

🛡 普通管理员 (is_admin)
   ├─ ✅ 只能管理普通用户（封禁 / 解封 / 删除 / 开关实例 / 用户空间）
   └─ ❌ 不能新增用户、不能操作其他管理员、不能操作自己

👤 普通用户
   └─ 只能用自己空间
```

### 管理员权能开关

`.env` 的 `ADMIN_ROLE_ENABLED` 控制**普通管理员**是否有后台权限：

| 值 | 效果 |
|----|------|
| `0`（默认） | **暂停**：后台仅超管可进。普通管理员登录主站、开实例、用自己的空间，**与普通用户完全一致**（`/api/me` 返回 `is_admin:false`、`need_email:true`）；`/api/admin/*` 一律 `403`、`/linjiuser` 只返回登录页 |
| `1` | **恢复**：普通管理员按上面的「🛡 普通管理员」行事 |

数据库里的 `is_admin=1` 标记始终保留，改回 `1` 并重启即可立刻恢复，无需重新设置。

```bash
sed -i 's/^ADMIN_ROLE_ENABLED=.*/ADMIN_ROLE_ENABLED=1/' /opt/tomato-multi/app/.env
systemctl restart tomato-gateway
```

实现要点：`effective_admin(u)` = `is_admin and (is_super or ADMIN_ROLE_ENABLED)`，
统一用于 `admin_required()`、JWT 的 `admin` 声明、`/api/login` 与 `/api/me` 的 `is_admin`、`need_email`、`/linjiuser`、`/api/admin/login`。

---

## 邮箱验证

- 注册必须邮箱 + 6 位验证码（`email_codes` 表存哈希，10 分钟有效，最多试 5 次）
- 域名白名单：`@qq.com` / `@163.com` / `@gmail.com`（`EMAIL_ALLOWED_DOMAINS` 可改）
- 前缀严格校验，防止随手乱填：

| 服务商 | 规则 |
|--------|------|
| `@qq.com` | 5–12 位**纯数字**（QQ 号） |
| `@163.com` | 3–20 位：**字母开头**（字母/数字/`_`/`.`/`-`），**或纯数字** |
| `@gmail.com` | 6–30 位，字母或数字开头（字母/数字/`.`/`_`/`+`/`-`） |

- 每日注册名额对齐 Resend 发信额度：读 `GET /usage` 的 `daily.used`，
  `used < DAILY_REG_LIMIT` 放行，否则提示「今日名额已满」。额度每日 **08:00（北京时间）** 重置。
- 登录支持**用户名或邮箱**。

---

## 维护要点

**实例生命周期**
- 用户点「启动」或访问自己子域名 → 懒启动实例（端口探测 + 串行化防重复拉起）
- 实例空闲 **20 分钟**（`instances.IDLE_TIMEOUT`，单位秒）→ 自动停止并清空 `books/` / `logs/`
- 每 60 秒扫描一次（`sweep_loop`）
- 判断实例是否存活：**端口可连 或 进程存在**（宽松判断，避免误杀）
- 进程归属判断用**路径边界正则**（`--data-dir <dir>` 后必须紧跟空格或行尾），
  不能用子串匹配（否则 `u2` 会误匹配 `u25`）

**存储路径**
- 每个用户的 `config.yml` 里 `save_path` 由 `instances.ensure_save_path()` 在启动时校正为
  `<data_dir>/books`；为空或非法时自动重写，避免番茄进程把书存到工作目录

**改配置后生效**
```bash
systemctl restart tomato-gateway      # 改了 main.py / db.py / instances.py
nginx -s reload                       # 只改了 nginx / 证书
```

**日志**

| 文件 | 内容 |
|------|------|
| `/opt/tomato-multi/app/run.log` | 网关运行日志 |
| `/opt/tomato-multi/app/data/audit.log` | 审计日志（敏感操作） |
| `/opt/tomato-multi/app/data/downloads.log` | 软件下载记录 |
| 每个用户 `data/users/u<N>/logs/` | 该用户番茄实例日志 |

---

## 安全说明

- 全部 `/api/*` 走**默认拒绝**中间件（白名单外强制登录）
- SQL 全参数化；密码 bcrypt；JWT 校验签名 + 会话 sid + 密码版本号
- 退出 / 改密 / 封禁 → 立即吊销该用户全部会话
- 登录限流（5 次失败锁 5 分钟）、注册限流、目录穿越防护、路径 `realpath` 校验
- nginx 兜底块：Host 不匹配的请求（IP 直连 / 未知域名）一律 `return 444`
- 关闭 `/docs` `/redoc` `/openapi.json`

---

## 真人校验（Cloudflare Turnstile）—— 当前默认关闭

> **现状：已关闭。** 曾经开启过，因误判率偏高（正常用户被拦）而整体停用。
> 代码完整保留，`.env` 填上两项即恢复。

**配置**（`.env`）：
```ini
TURNSTILE_SITEKEY=0x4AAAAAAA...   # 公开，前端用
TURNSTILE_SECRET=0x4AAAAAAA...    # 私密，服务端校验用
```
两项**任一为空 = 功能整体关闭**：`/api/human/status` 返回 `required:false`，
前端**按需加载** CF 脚本（关闭状态下零 Cloudflare 请求）。

**开启后的覆盖范围**（全部强制，超管会话豁免）：

| 入口 | 说明 |
|------|------|
| 主站落地页 | 全屏验证门，通过后才显示登录/注册 |
| `POST /api/register` | 未验证 → `403` |
| `POST /api/login` | 未验证 → `403`（**全员，无用户名豁免**） |
| 用户子域名 `uN.域名` | `auth_check` 子请求同样校验 |

> **安全教训**：`/api/login` 曾经按**用户名**豁免超管，导致攻击者可用
> `403`（无验证）vs `401`（密码错）的差异**探测超管账号**。
> 现改为：登录一律先过真人校验，超管豁免**只认「已登录的超管会话」**。

**例外**：管理后台登录走独立的 `POST /api/admin/login`，不需要真人校验
（后台登录页没有验证组件）。

**关闭方法**：
```bash
sed -i 's/^TURNSTILE_/#&/' /opt/tomato-multi/app/.env
systemctl restart tomato-gateway
```

**坑位提醒**：
- 公告弹窗 `z-index` 是 `2147483647`（int 最大值），会盖住验证门 →
  `announce.js` 轮询 `window.__HUMAN_GATE_PENDING__`，等验证门通关再弹
- 更新 `announce.js` 后把 nginx 注入 URL 的 `?v=N` 加一，否则浏览器用旧缓存

---

## 已知约束

- 主站/子域用 Let's Encrypt **泛域名证书**（`*.域名`），续期后需 `nginx -s reload`
- 登录限流是**进程内存态**，重启网关即清空
- 管理员无法「查看」密码，只能「重置」（bcrypt 不可逆）
- 实例清理**只针对已关闭的实例**，运行中的绝不动
- 升级下载内核依赖服务器能访问 GitHub；国内服务器可配代理或手动替换 `bin/tomato`

---

## 相关仓库

| 仓库 | 说明 |
|------|------|
| [zhongbai2333/Tomato-Novel-Downloader](https://github.com/zhongbai2333/Tomato-Novel-Downloader) | **上游本体**：解析与下载实现 |
| [yujunc39-arch/Tomato-Novel-Downloader](https://github.com/yujunc39-arch/Tomato-Novel-Downloader) | 上游 fork（纯安卓客户端开发） |
| yujunc39-arch/Tomato-Web | 本仓库：多租户 Web 外壳 |
