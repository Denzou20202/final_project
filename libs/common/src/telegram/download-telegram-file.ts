// Downloads a Telegram-hosted file (photo/document) by its file_id — a
// two-step dance the Bot API requires: resolve file_id to a file_path via
// getFile, then fetch the actual bytes from a *different* host
// (api.telegram.org/file/..., not api.telegram.org/bot.../...).
export async function downloadTelegramFile(
  token: string,
  fileId: string,
): Promise<{ buffer: Buffer; filePath: string }> {
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!infoRes.ok) {
    throw new Error(`Telegram getFile ${infoRes.status}: ${await infoRes.text()}`);
  }
  const info = (await infoRes.json()) as { result?: { file_path?: string } };
  const filePath = info.result?.file_path;
  if (!filePath) {
    throw new Error('Telegram getFile returned no file_path');
  }

  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!fileRes.ok) {
    throw new Error(`Telegram file download ${fileRes.status}`);
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, filePath };
}
