// GitHub 风格贡献热力图 — 按日期统计发文数
const COLORS = ['#ebedf0', '#4db6ac', '#26a69a', '#00897b']; // 0,1,2,3+篇

function getDateKey(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getColor(count) {
  if (count >= 3) return COLORS[3];
  if (count >= 1) return COLORS[count];
  return COLORS[0];
}

function buildHeatmap(posts) {
  const countMap = {};
  posts.forEach(post => {
    const key = getDateKey(post.date.toDate());
    countMap[key] = (countMap[key] || 0) + 1;
  });

  const dates = Object.keys(countMap).sort();
  if (dates.length === 0) return '<p style="text-align:center;color:#999;padding:12px">暂无数据</p>';

  const today = new Date();

  // 结束于本周六
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));

  // 开始于第一篇文所在周的周日
  const firstDate = new Date(dates[0]);
  const start = new Date(firstDate);
  start.setDate(start.getDate() - start.getDay());

  // 最少显示 10 周，最多 20 周
  const minWeeks = 10;
  const maxWeeks = 20;
  const minStart = new Date(end);
  minStart.setDate(minStart.getDate() - maxWeeks * 7 + 1);
  if (start < minStart) start.setTime(minStart.getTime());

  // 如果不满 minWeeks 周，把 start 往前拉
  const needWeeks = minWeeks;
  const gap = (end - start) / 86400000;
  if (gap < needWeeks * 7) {
    start.setDate(start.getDate() - Math.ceil(needWeeks * 7 - gap));
  }

  const totalDays = Math.ceil((end - start) / 86400000) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);

  // 周日=0 ~ 周六=6
  const dayLabels = ['', '一', '', '三', '', '五', ''];

  // 月标签（记录每月第一天所在的列）
  const monthCols = {}; // col -> monthNum
  for (let w = 0; w < totalWeeks; w++) {
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7 + 3); // 周三位置判断月
    monthCols[w] = d.getMonth() + 1;
  }

  let prevMonth = -1;
  const monthLabels = [];
  for (let w = 0; w < totalWeeks; w++) {
    if (monthCols[w] !== prevMonth) {
      monthLabels[w] = monthCols[w] + '月';
      prevMonth = monthCols[w];
    } else {
      monthLabels[w] = '';
    }
  }

  let html = '<div class="heatmap-wrapper">';

  // 月标签行
  html += '<div class="heatmap-months">';
  html += '<div class="heatmap-day-label"></div>';
  for (let w = 0; w < totalWeeks; w++) {
    html += '<span class="heatmap-month-label">' + (monthLabels[w] || '') + '</span>';
  }
  html += '</div>';

  // 7 天行
  for (let day = 0; day < 7; day++) {
    html += '<div class="heatmap-row">';
    html += '<span class="heatmap-day-label">' + (dayLabels[day] || '') + '</span>';
    for (let w = 0; w < totalWeeks; w++) {
      const d = new Date(start);
      d.setDate(d.getDate() + w * 7 + day);
      if (d > today) {
        // 未来日期不显示
        html += '<span class="heatmap-cell heatmap-future"></span>';
        continue;
      }
      const key = getDateKey(d);
      const count = countMap[key] || 0;
      const color = getColor(count);
      const dateStr = (d.getMonth() + 1) + '月' + d.getDate() + '日';
      const title = dateStr + ': ' + (count > 0 ? count + '篇文章' : '无发文');
      html += '<span class="heatmap-cell" style="background:' + color +
        '" title="' + title + '" data-count="' + count + '"></span>';
    }
    html += '</div>';
  }

  // 图例
  html += '<div class="heatmap-legend">';
  html += '<span class="legend-label">少</span>';
  COLORS.forEach(c => {
    html += '<span class="legend-cell" style="background:' + c + '"></span>';
  });
  html += '<span class="legend-label">多</span>';
  html += '</div>';

  html += '</div>';
  return html;
}

// 注册 after_render:html 过滤器
hexo.extend.filter.register('after_render:html', function (str) {
  const posts = hexo.locals.get('posts');
  if (!posts || !posts.data) return str;
  return str.replace('<div id="blog-heatmap"></div>', buildHeatmap(posts.data));
});
