# 精选歌单与博客集成

此 fork 保留原播放器，新增自动精选歌单。浏览器读取静态的 `data/featured.json`；GitHub Actions 负责更新歌单元数据，点击歌曲后才按歌曲 ID 获取音源。无需常驻后端或账号 Cookie。

## 本地开发

需要 Node.js 22 或更新版本，无需安装 npm 依赖。

```sh
npm test
npm run test:coverage
npm run update:featured
npm run export:site -- /Users/wepie/Documents/Doc/blog/source/music
```

然后在博客目录执行 `npm run build`、`npm run server`，打开 `/music/`。音乐站源码修改后需要重新导出。`export:site` 只复制公开文件，并保留目标目录已有的其他文件。

## 数据与播放

- 网易云、QQ、酷我各展示最多 12 个推荐歌单，每单最多收录 500 首歌曲。详情会显示收录数量及原歌单数量。
- 平台筛选支持“全部平台”，合并展示三个平台的歌单并按共同标签筛选；歌单卡片和详情标明来源。
- 分类来自歌单自身的标签；目前酷我推荐接口没有标签，因此不提供分类筛选。
- 更新某个平台全部失败时保留上次该平台的数据与时间；部分歌单失败时保留对应旧歌单。全部平台失败会使 Actions 报错，已有快照仍可用。
- 浏览器刷新失败时保留内存中的歌单，首次加载失败时尝试读取本地缓存。禁用存储或存储满时仍可正常使用服务端快照。
- 网易云沿用上游 Meting 音源接口；QQ 沿用上游 Tang 音源接口；酷我使用公开 mobi 接口。QQ 和酷我必须返回与歌单一致的歌曲 ID，不能用同名歌曲替代。酷我受限歌曲可能返回另一首 11 秒的提示音，会因 ID 不一致被拒绝。
- 收藏和自建歌单保存歌曲标识，不保存临时音频地址，重新播放时解析音源。
- 付费、下架、区域限制、第三方接口故障都会影响播放。HTTP 成功不表示可以完整播放；部分歌曲可能只能试听。
- 整单播放失败会跳过歌曲；连续五首失败或全单失败则停止。音源启动等待最多 20 秒，快速切歌不会被旧请求覆盖。浏览其他歌单和切换标签不改变当前队列。

## GitHub Pages 上线顺序

1. 将音乐站改动发布到 `fengzhouxuan/musicsquare` 的 `main`。
2. 在 fork 的 Actions 页面启用工作流，手动运行 **Update featured playlists**，确认更新与写入成功。
3. 将博客集成改动发布到博客仓库的 `main`。博客的 Pages 工作流会检出音乐站 `main`，导出到 `source/music` 再构建网站。
4. 检查 `https://fengzhouxuan.github.io/music/`，再验证线上音频、收藏和手机布局。

音乐站配置为每天北京时间 10:17 更新；博客配置为 11:17 重新部署。GitHub 定时执行可能延迟，时间间隔不是任务间的强制依赖。也可手动运行两个工作流。

定时工作流需要文件位于默认分支。公共仓库 60 天没有活动时，GitHub 会自动停用定时工作流；fork 默认也需要启用 Actions。参见 [GitHub 事件与定时规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。

当前本地分支为 `codex/featured-playlists`（音乐站）和 `codex/music-station`（博客）。尚未推送，也尚未验证 GitHub Actions 的实际执行。博客原有未推送提交应在发布前一并检查。
