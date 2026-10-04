<p align="center">
  <img src="docs/logo.png" alt="MusicSquare logo" width="640">
</p>

<p align="center">
  <strong>学习收获更多有趣的内容, 欢迎关注微信公众号：Charles的皮卡丘</strong>
</p>

# 🌟 Overview

This fork adds automatically refreshed featured playlists from NetEase, QQ Music and Kuwo, plus an export script for the `/music/` section of a Hexo site. See [精选歌单与博客集成](FEATURED_PLAYLISTS.md) for local commands, playback limitations and deployment steps.

## GitHub 登录与音乐库同步

音乐站与视频站共用现有 GitHub OAuth 应用、邀请名单、Worker 账号服务和 D1 数据库。同一来源下两个站点使用同一个会话；各账号的音乐库、视频收藏和未登录本机数据分别存储。首次登录后可点击“导入本机歌单与收藏”，原本机音乐库保留。

收藏歌曲和自建歌单先写本机，再自动同步；失败时保留待同步修改。版本冲突使用上次同步快照、本机修改和云端新快照合并，歌曲或歌单删除优先，独立添加保留；歌单名称和歌曲顺序也参与合并。播放链接、歌词和播放状态在播放时重新获取。

云端每份收藏/歌单上限1000首、100个自建歌单，音乐库元数据上限1MB。超出云端限制的旧音乐库继续在本机保留，页面显示限制原因，整理后可恢复同步。导出的 JSON 仍可本机备份和导入。

`shared/` 是 `videostation/shared/` 公共账号与同步模块的发布副本，维护公共逻辑时先修改视频仓库，再执行：

```sh
npm run sync:shared -- ../videostation/shared
npm test
npm run sync:blog -- ../blog
```

`config.js` 指向现有账号服务。后端需要应用 `videostation/migrations/0002_music_library.sql` 并部署新 Worker，详情见视频仓库 README 的发布步骤。GitHub Pages 构建会检查音乐与视频的公共模块是否一致，发布时先推送 musicsquare，再发布博客。

MusicSquare is a simple music search, download, and play website. 
It provides a lightweight, browser-friendly interface to search, play, and download music directly from your GitHub Pages site.

This GitHub Pages deployment is available at:

👉 **Live URL:** <https://charlespikachu.github.io/musicsquare/>


## ✨ Key Features

- 🎵 **Online music search & playback**  
  Supports searching songs by keyword and playing them directly in the browser.

- 📻 **Multiple music sources**  
  Integrates online platforms such as Netease, Kuwo, JOOX and QQ.

- 🍃 **Warm paper UI**

  A warm white interface matching the blog, with featured playlist cards, a compact player dock, and an expandable lyrics panel.


## 🚀 How to Use

1. Open the live site:  
   👉 <https://charlespikachu.github.io/musicsquare/>

2. Use the search box to input an artist name or song title (e.g., “周杰伦”).

3. Click on a result to start playback and enjoy the music.


## 💻 Development & Customization

- This site is hosted via **GitHub Pages**.
- You can customize:
  - Theme (colors, background, icons)
  - API endpoints (e.g., your own proxy/bridge server for Netease, Kuwo, JOOX and QQ.)
  - Player behavior (autoplay, playlist, lyrics panel, etc.)

For more details, check the source files in this repository and adjust the HTML / CSS / JavaScript as needed.
