#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const reportPath = path.resolve(process.cwd(), 'eslint-report.json');
const htmlPath = path.resolve(process.cwd(), 'eslint-report.html');

let results = [];
try {
  const raw = readFileSync(reportPath, 'utf8');
  results = JSON.parse(raw);
} catch (error) {
  console.warn(`无法读取 ${reportPath}:`, error.message);
}

const rows = [];
results.forEach((fileResult) => {
  const filePath = fileResult.filePath || 'unknown';
  (fileResult.messages || []).forEach((msg) => {
    const severityLabel = msg.severity === 2 ? 'error' : 'warning';
    rows.push(`      <tr>
        <td>${filePath}</td>
        <td>${msg.line ?? '-'}</td>
        <td>${severityLabel}</td>
        <td>${msg.ruleId ?? '-'}</td>
        <td>${msg.message}</td>
      </tr>`);
  });
});

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>ESLint 报告</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    th { background: #f0f0f0; }
    tbody tr:nth-child(odd) { background: #fafafa; }
    .severity-error { color: #d32f2f; font-weight: 600; }
    .severity-warning { color: #f57c00; font-weight: 600; }
  </style>
</head>
<body>
  <h1>ESLint 报告</h1>
  <p>共 ${rows.length} 条问题。</p>
  <table>
    <thead>
      <tr>
        <th>文件</th>
        <th>行</th>
        <th>严重性</th>
        <th>规则</th>
        <th>描述</th>
      </tr>
    </thead>
    <tbody>
${rows.join('\n')}
    </tbody>
  </table>
</body>
</html>`;

writeFileSync(htmlPath, html, 'utf8');
console.log(`已生成 ${htmlPath}`);
