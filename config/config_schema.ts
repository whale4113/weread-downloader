import { z } from 'zod'

export const Config: z.ZodObject<
  {
    puppeteer: z.ZodObject<
      {
        launch: z.ZodObject<
          {
            executablePath: z.ZodOptional<z.ZodString>
          },
          z.core.$strict
        >
      },
      z.core.$strict
    >
    weread: z.ZodObject<
      {
        books: z.ZodArray<
          z.ZodObject<
            {
              chapters: z.ZodOptional<z.ZodArray<z.ZodString>>
              combine: z.ZodDefault<z.ZodBoolean>
              id: z.ZodOptional<z.ZodString>
            },
            z.core.$strict
          >
        >
        enableCache: z.ZodDefault<z.ZodBoolean>
      },
      z.core.$strict
    >
  },
  z.core.$strict
> = z
  .object({
    puppeteer: z
      .object({
        launch: z
          .object({
            executablePath: z
              .string()
              .describe(
                'Path to a browser executable to use instead of the bundled Chromium. Note that Puppeteer is only guaranteed to work with the bundled Chromium, so use this setting at your own risk.'
              )
              .optional(),
          })
          .strict(),
      })
      .strict(),
    weread: z
      .object({
        books: z.array(
          z
            .object({
              chapters: z
                .array(z.string())
                .describe('要下载的章节名称')
                .optional(),
              combine: z
                .boolean()
                .describe('是否合并为一个文件')
                .default(false),
              id: z.string().describe('书籍 ID').optional(),
            })
            .strict()
        ),
        enableCache: z
          .boolean()
          .describe('是否使用缓存（output 中已经存在的章节，不会再下载）')
          .default(false),
      })
      .strict(),
  })
  .strict()
