// 强制注入自定义 CSS（绕开主题 inject 兼容性问题）
const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function(str, data) {
  const cssPath = path.join(hexo.source_dir, 'css', 'custom.css');
  if (!fs.existsSync(cssPath)) return str;

  const css = fs.readFileSync(cssPath, 'utf-8')
    .replace(/\n\s*/g, ' ')   // 压缩成一行
    .replace(/\s+/g, ' ')
    .trim();

  const styleTag = '<style id="custom-css">' + css + '</style>';
  return str.replace('</head>', styleTag + '\n</head>');
});
