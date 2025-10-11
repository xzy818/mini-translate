import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function verifyIcons() {
  const iconDirs = [
    path.join(__dirname, '..', 'dist', 'icons'),
    path.join(__dirname, '..', 'public', 'icons')
  ];

  const requiredSizes = [16, 32, 48, 128];
  const requiredFiles = ['icon.svg'];

  console.log('验证图标文件...\n');

  iconDirs.forEach(dir => {
    console.log(`检查目录: ${dir}`);
    
    // 检查PNG文件
    requiredSizes.forEach(size => {
      const pngFile = path.join(dir, `icon-${size}.png`);
      if (fs.existsSync(pngFile)) {
        const stats = fs.statSync(pngFile);
        console.log(`  ✓ icon-${size}.png (${stats.size} bytes)`);
      } else {
        console.log(`  ✗ icon-${size}.png (缺失)`);
      }
    });

    // 检查SVG文件
    requiredFiles.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`  ✓ ${file} (${stats.size} bytes)`);
      } else {
        console.log(`  ✗ ${file} (缺失)`);
      }
    });

    console.log('');
  });

  // 检查manifest.json中的图标配置
  const manifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('manifest.json 图标配置:');
    console.log('  action.default_icon:', manifest.action?.default_icon);
    console.log('  icons:', manifest.icons);
  }

  console.log('\n图标验证完成！');
}

verifyIcons();
