
<div align="right">
  <details>
    <summary >🌐 Language</summary>
    <div>
      <div align="right">
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=en">English</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=zh-CN">简体中文</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=zh-TW">繁體中文</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=ja">日本語</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=ko">한국어</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=hi">हिन्दी</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=th">ไทย</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=fr">Français</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=de">Deutsch</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=es">Español</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=it">Itapano</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=ru">Русский</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=pt">Português</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=nl">Nederlands</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=pl">Polski</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=ar">العربية</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=fa">فارسی</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=tr">Türkçe</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=vi">Tiếng Việt</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=browserslist&project=update-db&lang=id">Bahasa Indonesia</a></p>
      </div>
    </div>
  </details>
</div>

# Update Browserslist DB

<img width="120" height="120" alt="Browserslist logo by Anton Popov"
     src="https://browsersl.ist/logo.svg" align="right">

CLI tool to update `caniuse-lite` with browsers DB
from [Browserslist](https://github.com/browserslist/browserslist/) config.

Some queries like `last 2 versions` or `>1%` depend on actual data
from `caniuse-lite`.

```sh
npx update-browserslist-db@latest
```

<a href="https://evilmartians.com/?utm_source=update-browserslist-db">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
       alt="Sponsored by Evil Martians" width="236" height="54">
</a>

## Why you need to call it regularly

`npx update-browserslist-db@latest` updates `caniuse-lite` version
in your npm, yarn, or pnpm lock file.

This update will bring data about new browsers to polyfill tools
like Autoprefixer or Babel and reduce already unnecessary polyfills.

You need to do it regularly for three reasons:

1. To use the latest browser’s versions and statistics in queries like
   `last 2 versions` or `>1%`. For example, if you created your project
   2 years ago and did not update your dependencies, `last 1 version`
   will return 2-year-old browsers.
2. Actual browser data will lead to using less polyfills. It will reduce
   size of JS and CSS files and improve website performance.
3. `caniuse-lite` deduplication: to synchronize versions in different tools.
