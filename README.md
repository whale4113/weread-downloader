# Weread Downloader

一个用于从微信读书网页端下载书籍内容的工具，仅供学习和研究使用。

## 声明

**本项目仅用于学习和技术研究，请勿用于任何商业或非法用途。所有下载内容版权归原作者和出版商所有。使用者因使用本工具而产生的一切法律后果，由使用者自行承担，与本项目作者无关。**

## 功能

-   提供交互式命令行界面，选择要下载的书籍章节。
-   将下载的章节保存为单独的 `.txt` 文件。
-   可选择将所有下载的章节合并为一个文件。

## 使用方式

### 1. 环境准备

-   安装 [Bun](https://bun.sh/)
-   安装 [Google Chrome](https://www.google.com/chrome/) 浏览器

### 2. 安装依赖

```bash
bun install
```

### 3. 运行程序

```bash
bun start
```

> **Note**
> 
> 本项目默认使用 MacOS 系统的 Chrome 路径，如果你使用其他操作系统，请使用配置文件，配置你电脑上 Chrome 的路径。
> 常见操作系统，Chrome 的可能路径：
> - Windows: `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`
> - MacOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

### 4. 使用配置文件

除了通过命令行交互式输入，你也可以通过在 `config` 目录下创建 `config.json` 文件来配置程序的行为。如果 `config.json` 文件中有配置 `books`，程序将读取该配置，并跳过一些必要的交互式命令行交互。（如果你未登录过微信读书网页端，终端仍然会提示并等待你登录）。

`config.example.json` 文件提供了一个配置示例：

```json
{
  "puppeteer": {
    "launch": {
      "executablePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    }
  },
  "weread": {
    "enableCache": false,
    "books": [
      {
        "id": "1623288055262216242d0f2",
        "chapters": ["第1章"]
      },
      {
        "id": "fa3322105ca0ecfa382cac6",
        "chapters": ["...", "文化偏至论"]
      },
      {
        "id": "f1e328e072710bfaf1e87e9",
        "chapters": [
          "第一章 童年",
          "...",
          "第六章 霸业的开始",
          "第七章 霸业的开始"
        ]
      }
    ]
  }
}
```

#### 配置项说明

-   `puppeteer.launch`: 你可以通过 `executablePath` 指定 Chrome 浏览器的路径。
-   `weread.enableCache`: 是否启用缓存，默认为 `false`。启用后，下次下载同一本书的同一章节时，如果发现 `output` 目录下已经存在该章节的文件，将直接跳过下载。
-   `weread.books`: 要下载的书籍列表。
    -   `id`: 书籍的详情页 ID。
    -   `chapters`: 要下载的章节列表。如果列表包含 `...`，则表示下载从 `...` 前一个章节到后一个章节之间的所有章节。例如 `["第一章", "...", "第五章"]` 将会下载第一章到第五章的所有章节。
    -   `combine`: 是否将下载的章节合并为一个文件，默认为 `false`。

### 5. 终端交互（可选）

运行程序后，根据命令行提示进行操作：

1.  **输入书籍 ID**
    系统会提示您输入书籍的 ID，例如：
    ```
    ✔ Please input book id. … fa3322105ca0ecfa382cac6
    ```

    页面打开后，如果未登录过，需要扫码登录后，在终端按 Enter 键确认登录过。

2.  **选择章节**
    输入链接后，程序会自动获取书籍章节列表。您可以根据提示进行选择：
    ```
    ? Please pick chapters. › - Space to select. Return to submit 
    Instructions:
        ↑/↓: Highlight option
        ←/→/[space]: Toggle selection
        a: Toggle all
        enter/return: Complete answer
    ◯   版权信息
    ◯   鲁迅全集 第一卷
    ...
    ```
    使用空格键选择章节，按回车键确认。

3.  **合并文件**
    您可以选择是否将下载的所有章节合并成一个文件：
    ```
    ? Combine output text file? › (y/N)
    ```

4.  **下载完成**
    下载完成后，文件将保存到 `output` 文件夹中。

### FAQ

#### 1. 如何获取书籍 ID？
  
打开微信读书网页端，点击书籍，进入阅读（⚠️ 注意：须要第一次进入）。复制浏览器地址栏中的 URL 最末尾的书籍 ID。比如 `https://weread.qq.com/web/reader/fa3322105ca0ecfa382cac6` 中，书籍 ID 为 `fa3322105ca0ecfa382cac6`。你可以通过打开 `https://weread.qq.com/web/bookDetail/书籍 ID`，来确认是否获取到正确的书籍 ID。如果正常展示，则书籍 ID 正确。