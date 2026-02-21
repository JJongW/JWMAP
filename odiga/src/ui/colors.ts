import chalk from 'chalk';

// 오늘오디가? 브랜드 색상
const orange = '#FF8A3D';     // point - Apricot Orange
const orangeDark = '#E67A35'; // point.hover - darker Apricot Orange

export const c = {
  title: chalk.bold.hex(orange),
  subtitle: chalk.gray,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  highlight: chalk.bold.hex(orange),
  dim: chalk.dim,
  step: chalk.bold.hex(orangeDark),
  distance: chalk.hex(orange),
  score: chalk.hex(orange),
  link: chalk.underline.hex(orange),
  emoji: {
    walk: '🚶',
    pin: '📍',
    star: '⭐',
    fire: '🔥',
    map: '🗺️',
    save: '💾',
    stats: '📊',
    story: '📖',
    course: '🛤️',
    search: '🔍',
    check: '✅',
    warn: '⚠️',
  },
};
