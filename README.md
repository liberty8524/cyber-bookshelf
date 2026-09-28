# 藏间 · Digital Bookshelf

一个支持独立账号的 PDF 数字书房。每个人注册后拥有自己的书架，书籍、PDF 与阅读进度按账号隔离。书籍以有纹理的书脊排列在木质书架上，包含暖光、悬停前移、抽书动画、封面详情与真实 PDF 阅读器。

![升级后的书架](docs/screenshots/upgrade/modern-1440.png)

## 多用户版本

打开网页先注册或登录。每个新账号会获得 17 本独立、可删除的示例书，顶部可退出账号。
旧版书籍与阅读进度保留，并自动备份数据库；归入自己的账号只需执行一次本机管理命令。详见 [账号迁移与公网部署](docs/deployment.md)。

![登录页面](docs/screenshots/login.png)

## 功能

- 四套完整主题：Modern Minimal、Classic Wood、Dark Study、Cute Cozy。材质、灯光、控件、字体、书籍色调和阴影随主题变化；浏览器保存主题。
- 稳定的书脊尺寸、颜色、装饰与倾斜角；书架按实际宽度自动分层，每层最多 10 本，移动端重新排架。
- 本地 PDF 导入，最大 100 MB；提取 PDF 书名、作者及页数，书名回退到文件名。
- 支持空文件、非 PDF、损坏文件、加密文件、过大文件与网络失败提示。
- 书名与作者搜索、分类筛选、信息编辑、删除确认。
- PDF.js 本地渲染：前后翻页、页码跳转、50%—250% 缩放、返回书架。
- SQLite 保存 current_page、total_pages、last_read_at；下次从保存页继续。
- 页面支持键盘操作：/ 聚焦搜索，Esc 关闭详情或阅读器，阅读器左右方向键翻页。弹窗约束 Tab 焦点，尊重系统减少动画设置。
- 新账号自动获得 17 本独立示例书，现有账号也会补充一次。删除后不会在刷新、登录或重启时重新出现；各账号拥有独立 PDF，互不影响。示例 PDF 是原创演示页，**不是原著全文**。

## 技术栈

原生 JavaScript 模块、Vite、CSS、Lucide 图标；Python FastAPI、SQLite、pypdf；PDF.js。PDF worker、CMap、标准字体和 WASM 均随项目本地部署，运行不依赖第三方 CDN。界面字体使用系统字体回退。

## 项目结构

```text
赛博书架/
├─ frontend/
│  ├─ main.js                 书架、主题、弹窗、上传与编辑
│  ├─ reader.js               PDF.js 阅读及进度同步
│  └─ styles.css              主题、材质、动画与响应式布局
├─ backend/
│  ├─ main.py                 应用生命周期及生产静态服务
│  ├─ database.py             SQLite 连接及表结构
│  ├─ schemas.py              请求校验
│  ├─ routes/books.py         藏书 API
│  ├─ services/pdf_service.py  PDF 校验和元数据解析
│  ├─ services/seed.py         示例 PDF 生成
│  ├─ requirements.txt
│  └─ requirements-lock.txt   本次验证的确切依赖版本
├─ uploads/                   实际 PDF 文件
├─ database/bookshelf.db      实际数据库，首次启动生成
├─ public/pdf-assets/         PDF.js 本地资源，安装后自动复制
├─ scripts/                   资源复制、启动及浏览器检查
├─ tests/test_api.py          隔离数据库的集成测试
├─ docs/screenshots/          四主题、详情、阅读器与响应式截图
├─ dist/                     生产构建
├─ package.json
└─ vite.config.js
```

## 安装

需要 Python 3.10+、Node.js 20.19+ 或 22.12+。所有命令在项目根目录执行。以下为 Windows PowerShell 示例：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --cache-dir .cache/pip -r backend/requirements-lock.txt
npm ci --cache .cache/npm
```

当前电脑已经安装好项目内的 .venv、node_modules 和构建产物，无须重新安装。
如果 python 命令未加入 PATH，可以用本机 Python 可执行文件的完整路径创建虚拟环境。

## 启动方式

### 日常使用：只启动一个服务

```powershell
npm run build
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

打开 [数字书房](http://127.0.0.1:8000)。按 Ctrl+C 停止。

也可以执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

### 开发模式：两个终端

后端：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --reload-dir backend --host 127.0.0.1 --port 8000
```

前端：

```powershell
npm run dev
```

打开 [开发页面](http://127.0.0.1:5173)。Vite 将 /api 请求代理到后端。
API 文档：[Swagger](http://127.0.0.1:8000/docs)。

## 数据与备份

- PDF 以随机文件名存放在 uploads，数据库记录相对文件名与 owner_id，文件下载必须通过账号鉴权。
- 关闭服务后，将 database 和 uploads 两个目录一起备份或迁移。
- 主题按账号保存在当前浏览器 localStorage；开发端口和生产端口有各自的主题设置。
- 删除会同时移除记录、阅读进度与本地 PDF，并且需要确认。
- 升级自动生成 database/bookshelf-before-accounts.db 备份。注册自己的账号后，执行 .venv/Scripts/python.exe -m backend.manage claim-legacy 你的用户名 接收旧藏书。

## 检查与截图

```powershell
npm test
npm run build
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

API 集成测试覆盖上传元数据、实际文件保存、读取 PDF、编辑、搜索、分类、进度边界、删除文件、失败清理和示例不重复生成。使用项目内部临时目录，不修改个人藏书。

浏览器检查脚本 scripts/check-accounts-ui.mjs 使用本次环境中已有的 Playwright 和 Edge，可通过 PLAYWRIGHT_PATH、BROWSER_PATH、PYTHON 环境变量覆盖路径。脚本启动独立测试服务与数据库，验证双账号注册、登录、上传、阅读、退出、越权拒绝和主题隔离；不会修改个人数据库。scripts/check-ui.mjs 为兼容入口。

截图位置：

- docs/screenshots/modern.png
- docs/screenshots/classic.png
- docs/screenshots/dark.png
- docs/screenshots/cozy.png
- docs/screenshots/book-detail.png
- docs/screenshots/reader.png
- docs/screenshots/desktop-1366.png
- docs/screenshots/mobile.png

## 当前范围

当前版本支持单服务多账号，适合少量用户共享一台服务器。封面为根据书籍信息生成的装帧效果；阅读器目前为单页画布，未实现文字选择、批注和全文检索。加密 PDF 需先解密。大文件的解析速度取决于文档复杂度和本机性能。

## 后续计划

- PDF 首页面封、可选择的文本层、目录与批注。
- 在 services 下扩展文档提取、分块和索引服务。
- 单独增加 AI 路由及任务模块，支持总结、问书、章节笔记和 RAG。
- 已完成注册、登录、会话及账号隔离；尚未提供邮箱验证和网页自助找回密码，本机管理员可运行 backend.manage reset-password 协助重置。
- 当前不包含社交、书城、AI、OCR 或 EPUB。
- Docker 与 HTTPS 部署配置已提供，当前电脑未安装 Docker，容器运行尚待服务器验收。

## 前端视觉升级

书架材质、分类装帧、主题变量、取书动画及响应式适配说明见 [视觉升级文档](docs/visual-upgrade.md)。
