# Something Ventured

Something Ventured 俱乐部官网：一个单页静态网站，根据《Something Ventured 俱乐部介绍》（2026.10 内部同步版）制作。

纯 HTML / CSS / JS，没有框架、没有构建步骤，也不依赖任何境外 CDN（字体全部自托管），在大陆网络和微信内置浏览器里都能正常打开。

## 本地预览

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 页面结构

| # | 区块 | 内容 |
|---|---|---|
| — | Hero | 英文 wordmark、`Nothing ventured, nothing gained.`、杭州 Library 开业倒计时（自动计算到 2026.12.15） |
| 01 | The Offline Premium | 后 AI 时代：真实 / 在场 / 不可替代 |
| 02 | On the Name | 纪录片出处；“Nothing → Something” 改稿动画；1950s—2026 年表 |
| 03 | The Club | 会员身份 vs 顾客：一张图讲清“会员与整个网络发生关系” |
| 04 | Hangzhou | “折叠空间”：随滚动，一条街的三家店折叠成一栋三层楼 |
| 05 | 3F Library | 白天 / 夜晚切换（白天仅会员，夜晚对公众开放）、借书卡 |
| 06 | Membership | 推荐 → 筛选 → 入会仪式 → 欢迎；专享活动（筹备中） |
| 07 | Apply | “Term Sheet” 申请表 + 实时生成的会员卡预览 |

## 上线前清单

- [ ] **申请表接口**：`index.html` 里 `#apply-form` 的 `data-endpoint` 目前为空，表单只做本地演示、不会发送任何数据。填上接收 POST JSON 的地址后才会真正提交。提交的字段：`name, venture, sector, base, lead, contact, thesis, submitted_at, page`。
- [ ] **分享图**：`og:image` 现在是相对路径，部署后请改成带域名的绝对地址。微信里的分享卡片需要另外接入微信 JS-SDK。
- [ ] **托管**：部署到大陆服务器需要 ICP 备案。
- [ ] **文案确认**：内部资料里的一些表述在页面上做了公开化处理（例如没有写年龄段，“形式设计中”改为“入会时揭晓”，规划中的内容都标了“筹备中 / 规划中”）。上线前请与团队核对。
- [ ] **Wordmark**：页面上的 wordmark 用 Source Serif 4 排出，如果已有正式的标志文件，替换 `.hero__mark`、`.nav__mark`、`.foot__mark` 即可。

## 字体

| 用途 | 字体 | 文件 |
|---|---|---|
| 英文衬线（标题、wordmark） | Source Serif 4（可变字体，含 optical size） | `assets/fonts/source-serif-4-latin-var*.woff2` |
| 中文衬线（中文标题） | Noto Serif SC SemiBold，**只包含页面用到的字** | `assets/fonts/noto-serif-sc-600-subset.woff2` |
| 等宽（标签） | IBM Plex Mono | `assets/fonts/ibm-plex-mono-latin-*.woff2` |
| 中文正文 | 系统字体（苹方 / 微软雅黑） | — |

**改了中文文案后要重新生成中文字体子集**，否则新出现的字会回落到系统字体：

```bash
pip install fonttools brotli
mkdir -p /tmp/sv-fonts && (cd /tmp/sv-fonts && npm pack @fontsource/noto-serif-sc @fontsource-variable/source-serif-4 @fontsource/ibm-plex-mono && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar -xzf "$f" -C "${f%.tgz}"; done)
python3 scripts/build-fonts.py /tmp/sv-fonts
```

所有字体均为 SIL Open Font License。
