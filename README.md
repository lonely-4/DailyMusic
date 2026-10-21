# 日推

从专辑封面自动取色，生成一张有氛围感的日推歌曲海报。界面配色遵循 Material Design 3 的动态配色：主色、辅色、点缀色和表面色都由封面种子色展开。

曲库使用已部署的网易云音乐接口：[https://ncme-vc.vercel.app/docs/](https://ncme-vc.vercel.app/docs/)。打开页面会直接读取 Eve 的《心予報》。

## 命令行

粘贴网易云链接、分享文案或歌曲 ID，直接写出 PNG。需要本机有 Noto CJK 字体（Debian/Ubuntu 可用 `fonts-noto-cjk`）。

```bash
npm install
npm run poster -- "https://163cn.tv/bi94lQEJ"
npm run poster -- "https://y.music.163.com/m/song?id=1423990087" -t 歌单 -o 心予報.png
```

不带参数时会提示粘贴：

```bash
npm run poster
```

版式：`沉浸`、`歌单`、`刊头`、`胶片`、`独白`。画幅：`4:5`、`9:16`、`1:1`、`16:9`。歌单版式默认 16:9。

## 网页

```bash
npm install
npm run dev
```

- 搜索歌名，或粘贴歌曲 ID、`music.163.com` 链接、`163cn.tv` 短链。
- 封面颜色会写成界面主题，并铺进海报。
- 版式有沉浸、歌单、刊头、胶片、独白，画幅支持 4:5、9:16、1:1、16:9。
- 旁白默认取歌词里和歌名最接近的一句，可以改掉。
- 「保存海报」导出当前预览的 PNG。

浅色封面（留白多的插画）会自动排成浅底海报，避免把画面压黑。
