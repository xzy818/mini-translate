import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建SVG内容
function createSVG(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="white" rx="4"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" 
        text-anchor="middle" dominant-baseline="middle" fill="#2563eb">MT</text>
</svg>`;
}

// 生成PNG图标
async function generatePNGIcons() {
  const sizes = [16, 32, 48, 128];
  const outputDirs = [
    path.join(__dirname, '..', 'dist', 'icons'),
    path.join(__dirname, '..', 'public', 'icons')
  ];

  console.log('开始生成MT图标...');

  for (const outputDir of outputDirs) {
    // 确保目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成SVG文件
    const svgContent = createSVG(128);
    fs.writeFileSync(path.join(outputDir, 'icon.svg'), svgContent);
    console.log(`✓ 生成 ${outputDir}/icon.svg`);

    // 为每个尺寸生成PNG
    for (const size of sizes) {
      try {
        const svgBuffer = Buffer.from(createSVG(size));
        
        await sharp(svgBuffer)
          .png()
          .resize(size, size)
          .toFile(path.join(outputDir, `icon-${size}.png`));
        
        console.log(`✓ 生成 ${outputDir}/icon-${size}.png`);
      } catch (error) {
        console.error(`生成 ${size}x${size} 图标时出错:`, error.message);
      }
    }
  }

  console.log('MT图标生成完成！');
}

// 运行生成函数
generatePNGIcons().catch(console.error);
