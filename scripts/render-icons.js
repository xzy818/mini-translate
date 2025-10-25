import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const sizes = [128, 48, 32, 16];
const input = resolve('public/icons/icon.svg');
const outputDir = resolve('public/icons');

async function render() {
  await mkdir(outputDir, { recursive: true });

  const base = sharp(input, { density: 512 });

  await Promise.all(
    sizes.map(async (size) => {
      const outfile = resolve(outputDir, `icon-${size}.png`);
      await base
        .clone()
        .resize(size, size, { fit: 'contain' })
        .png({ compressionLevel: 9 })
        .toFile(outfile);
      // eslint-disable-next-line no-console
      console.warn(`Generated ${outfile}`);
    })
  );
}

render().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to render icons', error);
  process.exitCode = 1;
});
