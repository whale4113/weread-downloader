export const timeout: (timeout: number) => Promise<void> = (timeout: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })

export const sanitizeFileName = (name: string): string => {
  // Replace characters that are invalid in Windows file names, and also '/' which is invalid on Unix-like systems.
  return name.replace(/[<>:"/\\|?*]/g, '_')
}
