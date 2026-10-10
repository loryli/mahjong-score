# 🀄 麻将计分（M1 已完成）

四川麻将四人记账，单机热座；本地保存、断点续局、散场自动轧差 + 文字分享。
无构建、无后端、无框架工程，Vue 3（本地化）+ IndexedDB + PWA。

## 本机预览（必须用服务器，不能直接双击 HTML）

```bash
cd mahjong-score
python -m http.server 8099
```

浏览器打开 <http://127.0.0.1:8099> 。手机真机预览：手机连同一 WiFi，
浏览器开 `http://<电脑局域网IP>:8099`（首次若打不开，Windows 防火墙放行一下 Python）。

## 安装到手机桌面（PWA）

- **Android / Chrome**：打开页面 → 右上菜单 →「添加到主屏幕」→ 从图标启动，全屏、离线可用。
- **iPhone / Safari**：分享 →「添加到主屏幕」。

> PWA 安装与系统分享需要 **https**，或者 `127.0.0.1` / `localhost`。
> 局域网 IP（http://192.168.x.x）能打开页面、能记账，但无法安装和离线。

## 免费上线（GitHub Pages，获得 https）

1. 在 GitHub 新建仓库，把本目录内容推上去：
   ```bash
   cd mahjong-score
   git init && git add . && git commit -m "mahjong score M1"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
2. 仓库 **Settings → Pages → Source 选 `main` 分支 / 根目录 → Save**。
3. 等一两分钟，用给的 `https://<用户名>.github.io/<仓库名>/` 在手机打开并安装。
   （代码用相对路径，部署在子目录也正常。）

## 现在能做什么（M1）

- 新开局：4 个人名 + 底分/封顶番/雨倍率/每分¥/统一起始分
- 记一手：填 4 个带正负的数，**强制合计为 0** 才能入账，可加备注
- 计分板实时累计；每手时间轴，点任意一手可**编辑/删除**；撤销上一手
- 刷新、关页面不丢局；有未结束的场次可一键继续
- 散场：显示每人净输赢与金额，贪心轧差给出最少转账笔数，系统分享/复制战绩

## 后续

- **M2**：杠雨即时入账、和牌番种 chips（大对子/清一色/七对/龙七对/杠上花炮…）、
  血战多和、一炮多响、流局查叫/花猪（规则函数 `assets/js/rules.js` 已写好并通过单测，只差界面）
- **M3**：多场历史、玩家档案、中间插入补录、图片战绩卡

## 目录

```
index.html              页面（首页/本场/记一手/结算）
assets/styles.css       样式
assets/js/rules.js      纯规则函数（含 M2 算分，可 node 单测）
assets/js/db.js         IndexedDB 封装
assets/js/app.js        Vue 应用
assets/js/vendor/       Vue 3 本地离线包
manifest.webmanifest    PWA 清单
sw.js                   离线缓存
icons/                  192/512 图标（tools/make-icons.py 生成）
```
> 网页侧的改动
