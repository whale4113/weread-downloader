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
> 本项目默认使用 MacOS 系统的 Chrome 路径，如果你使用其他操作系统，请手动修改 `src/index.ts` 文件中 `executablePath` 选项的值为你电脑上 Chrome 的路径。
> 常见操作系统，Chrome 的可能路径：
> - Windows: `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`
> - MacOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

### 4. 终端交互

运行程序后，根据命令行提示进行操作：

1.  **输入书籍链接**
    系统会提示您输入书籍的详情页 URL，例如：
    ```
    ✔ Please input book detail page url. … https://weread.qq.com/web/bookDetail/fa3322105ca0ecfa382cac6
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
