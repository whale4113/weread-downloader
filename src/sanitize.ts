export const sanitizeFileName = (name: string) => {
  // Replace characters that are invalid in Windows file names, and also '/' which is invalid on Unix-like systems.
  return name.replace(/[<>:"/\\|?*]/g, '_');
};