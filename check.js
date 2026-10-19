/**
 * 项目自检脚本（在 Node 里跑，不依赖微信开发者工具）
 * 1. 所有 .js 做语法检查
 * 2. 所有 .json 做解析检查
 * 3. 所有 .wxml 做标签配对检查
 * 4. 检查 app.json 里注册的页面文件是否齐全
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
let errors = 0;
let files = 0;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const all = walk(ROOT);

/* ---------- 1. JS 语法 ---------- */
for (const f of all.filter((f) => f.endsWith('.js'))) {
  files++;
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    errors++;
    console.log('[JS 语法错误] ' + path.relative(ROOT, f));
    console.log(String(e.stderr || e.message).split('\n').slice(0, 4).join('\n'));
  }
}

/* ---------- 2. JSON ---------- */
for (const f of all.filter((f) => f.endsWith('.json'))) {
  files++;
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    errors++;
    console.log('[JSON 解析失败] ' + path.relative(ROOT, f) + ' -> ' + e.message);
  }
}

/* ---------- 3. WXML 标签配对 ---------- */
const VOID = new Set(['image', 'input', 'icon', 'progress', 'slider', 'switch', 'import', 'include', 'wxs']);

for (const f of all.filter((f) => f.endsWith('.wxml'))) {
  files++;
  const src = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const closing = m[1] === '/';
    const tag = m[2];
    const selfClose = m[4] === '/';
    if (selfClose || VOID.has(tag)) continue;
    if (!closing) {
      stack.push(tag);
    } else {
      const top = stack.pop();
      if (top !== tag) {
        errors++;
        console.log(
          '[WXML 标签不匹配] ' + path.relative(ROOT, f) + ' 期望 </' + top + '>，实际 </' + tag + '>'
        );
        break;
      }
    }
  }
  if (stack.length) {
    errors++;
    console.log('[WXML 未闭合] ' + path.relative(ROOT, f) + ' -> ' + stack.join(' > '));
  }
}

/* ---------- 4. 页面文件齐全 ---------- */
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
for (const p of appJson.pages) {
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
    const target = path.join(ROOT, p + ext);
    if (!fs.existsSync(target)) {
      errors++;
      console.log('[缺少文件] ' + p + ext);
    }
  }
}
for (const item of (appJson.tabBar && appJson.tabBar.list) || []) {
  if (!appJson.pages.includes(item.pagePath)) {
    errors++;
    console.log('[tabBar 页面未注册] ' + item.pagePath);
  }

  // tabBar 图标：配了就必须存在，否则开发者工具只显示文字
  for (const key of ['iconPath', 'selectedIconPath']) {
    const rel = item[key];
    if (!rel) {
      if (key === 'iconPath') {
        errors++;
        console.log('[tabBar 缺少图标] ' + item.text + '（只有文字没有图标）');
      }
      continue;
    }
    if (!fs.existsSync(path.join(ROOT, rel))) {
      errors++;
      console.log('[tabBar 图标不存在] ' + rel);
    }
  }
}

/* ---------- 5. 自定义组件路径 ---------- */
for (const f of all.filter((f) => f.endsWith('.json') && f.includes('pages'))) {
  const conf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const using = conf.usingComponents || {};
  for (const key of Object.keys(using)) {
    const p = using[key];
    const base = p.startsWith('/')
      ? path.join(ROOT, p.slice(1))
      : path.join(path.dirname(f), p);
    for (const ext of ['.js', '.json', '.wxml']) {
      if (!fs.existsSync(base + ext)) {
        errors++;
        console.log('[组件缺失] ' + path.relative(ROOT, f) + ' -> ' + p + ext);
      }
    }
  }
}

console.log('\n----------------------------------------');
console.log('检查文件数：' + files + '，问题数：' + errors);
console.log(errors === 0 ? '✅ 全部通过' : '❌ 存在待修复项');
process.exit(errors === 0 ? 0 : 1);
