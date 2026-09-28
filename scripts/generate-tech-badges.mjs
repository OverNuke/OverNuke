import { readFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StackIcon from 'tech-stack-icons';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const iconDir = join(root, 'assets', 'tech-icons');
const readmePath = join(root, 'README.md');

// This ordered list controls both the exported assets and their README badges.
const technologies = [
  { label: 'Python', slug: 'python', icon: 'python' },
  { label: 'Node.js', slug: 'nodejs', icon: 'nodejs' },
  { label: 'Express', slug: 'express', icon: 'expressjs' },
  { label: 'Odoo', slug: 'odoo', icon: 'custom' },
  { label: 'Java', slug: 'java', icon: 'java' },
  { label: 'Flutter', slug: 'flutter', icon: 'flutter' },
  { label: 'Dart', slug: 'dart', icon: 'dart' },
  { label: 'JavaScript', slug: 'javascript', icon: 'js' },
  { label: 'MySQL', slug: 'mysql', icon: 'mysql' },
  { label: 'Sequelize', slug: 'sequelize', icon: 'sequelize' },
  { label: 'React', slug: 'react', icon: 'react' },
  { label: 'OWL', slug: 'owl', icon: 'custom' },
  { label: 'HTML', slug: 'html', icon: 'html5' },
  { label: 'CSS', slug: 'css', icon: 'css3' },
  { label: 'Docker', slug: 'docker', icon: 'docker' },
  { label: 'Vitest', slug: 'vitest', icon: 'vitest' },
  { label: 'REST APIs', slug: 'rest-apis', icon: 'openapi' },
  { label: 'Git', slug: 'git', icon: 'git' },
];

const customPaths = {
  odoo: '<circle cx="32" cy="32" r="21" fill="none" stroke="COLOR" stroke-width="7"/><circle cx="32" cy="32" r="7" fill="COLOR"/>',
  owl: '<path d="M10 12 21 17 32 11 43 17 54 12v25c0 12-10 20-22 20S10 49 10 37V12Z" fill="none" stroke="COLOR" stroke-width="5" stroke-linejoin="round"/><circle cx="23" cy="32" r="5" fill="COLOR"/><circle cx="41" cy="32" r="5" fill="COLOR"/><path d="m27 43 5 5 5-5" fill="none" stroke="COLOR" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
};

function customSvg(slug, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${customPaths[slug].replaceAll('COLOR', color)}</svg>\n`;
}

function packageSvg(icon) {
  const markup = renderToStaticMarkup(React.createElement(StackIcon, { name: icon, variant: 'grayscale' }));
  const start = markup.indexOf('<svg ');
  const end = markup.lastIndexOf('</svg>');
  if (start < 0 || end < 0) throw new Error(`No SVG rendered for package icon: ${icon}`);
  return `${markup.slice(start, end + '</svg>'.length)}\n`;
}

function darkSvg(svg) {
  // Invert grayscale luminance into a light-on-dark range. Keeping distinct
  // shades preserves lettering and inner shapes (notably JS, HTML, and CSS).
  const invert = (red, green, blue) => {
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const shade = Math.round(255 - luminance * 0.62);
    return `#${shade.toString(16).padStart(2, '0').repeat(3)}`;
  };
  return svg
    .replace(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g, (color) => {
      const digits = color.slice(1);
      const channels = digits.length <= 4
        ? [...digits.slice(0, 3)].map((digit) => parseInt(digit + digit, 16))
        : [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16));
      const alpha = digits.length === 4 ? digits[3].repeat(2) : digits.length === 8 ? digits.slice(6) : '';
      return `${invert(...channels)}${alpha}`;
    })
    .replace(/\brgb\((\d+),\s*(\d+),\s*(\d+)\)/g, (_, red, green, blue) => invert(+red, +green, +blue))
    .replace(/(\b(?:fill|stroke|stop-color)=["'])(black|white)(["'])/g, (_, prefix, color, suffix) =>
      `${prefix}${color === 'black' ? '#ffffff' : '#616161'}${suffix}`)
    .replace(/(<stop\b(?![^>]*\bstop-color=)[^>]*)(\/>)/g, '$1 stop-color="#ffffff"$2');
}

async function writeIfChanged(path, content) {
  let previous;
  try { previous = await readFile(path, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previous !== content) await writeFile(path, content, 'utf8');
}

function badge({ label, slug }) {
  const base = `assets/tech-icons/${slug}`;
  return `<kbd><picture><source media="(prefers-color-scheme: dark)" srcset="${base}-white.svg"><source media="(prefers-color-scheme: light)" srcset="${base}-gray.svg"><img src="${base}-gray.svg" alt="" width="12" height="12" align="middle"></picture>&nbsp;${label.replaceAll(' ', '&nbsp;')}</kbd>`;
}

const check = process.argv.includes('--check');
if (process.argv.length > 2 && (process.argv.length !== 3 || !check)) {
  throw new Error('Usage: node scripts/generate-tech-badges.mjs [--check]');
}

const expectedIcons = new Map();
for (const technology of technologies) {
  const gray = technology.icon === 'custom'
    ? customSvg(technology.slug, '#666666')
    : packageSvg(technology.icon);
  const white = technology.icon === 'custom'
    ? customSvg(technology.slug, '#ffffff')
    : darkSvg(gray);
  expectedIcons.set(`${technology.slug}-gray.svg`, gray);
  expectedIcons.set(`${technology.slug}-white.svg`, white);
}

const readme = await readFile(readmePath, 'utf8');
const eol = readme.includes('\r\n') ? '\r\n' : '\n';
const block = [
  '<!-- tech-stack:start -->',
  '<p align="center">',
  ...technologies.map(badge),
  '</p>',
  '<!-- tech-stack:end -->',
].join(eol);
const stackHeadings = [...readme.matchAll(/^## Stack[ \t]*\r?$/gm)];
if (stackHeadings.length !== 1) throw new Error('Expected exactly one ## Stack heading.');
const stackStart = stackHeadings[0].index + stackHeadings[0][0].length;
const nextBoundary = /^(?:---[ \t]*|#{1,6}[ \t]+\S.*)\r?$/gm;
nextBoundary.lastIndex = stackStart;
const stackEnd = nextBoundary.exec(readme)?.index ?? readme.length;
const startMarker = '<!-- tech-stack:start -->';
const endMarker = '<!-- tech-stack:end -->';
const replaceStart = readme.indexOf(startMarker);
const endStart = readme.indexOf(endMarker);
if (replaceStart < 0 || endStart < 0 || readme.indexOf(startMarker, replaceStart + 1) !== -1 || readme.indexOf(endMarker, endStart + 1) !== -1) {
  throw new Error('Expected exactly one of each Stack marker.');
}
const replaceEnd = endStart + endMarker.length;
if (replaceStart < stackStart || replaceStart >= endStart || replaceEnd > stackEnd ||
    (replaceStart > 0 && readme[replaceStart - 1] !== '\n') ||
    !/^\r?(?:\n|$)/.test(readme.slice(replaceStart + startMarker.length)) ||
    (endStart > 0 && readme[endStart - 1] !== '\n') ||
    !/^\r?(?:\n|$)/.test(readme.slice(replaceEnd))) {
  throw new Error('Stack markers must be complete lines in order within ## Stack.');
}
const nextReadme = readme.slice(0, replaceStart) + block + readme.slice(replaceEnd);

let existingIcons;
try { existingIcons = (await readdir(iconDir)).filter((name) => name.endsWith('.svg')); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  existingIcons = [];
}
const unexpected = existingIcons.filter((name) => !expectedIcons.has(name));
if (unexpected.length) throw new Error(`Unexpected SVGs in assets/tech-icons: ${unexpected.join(', ')}`);

if (check) {
  const drift = [];
  if (nextReadme !== readme) drift.push('README Stack block');
  for (const [name, expected] of expectedIcons) {
    let actual;
    try { actual = await readFile(join(iconDir, name), 'utf8'); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (actual !== expected) drift.push(name);
  }
  if (drift.length) throw new Error(`Tech badge drift: ${drift.join(', ')}`);
  console.log(`Checked ${technologies.length} badges and ${expectedIcons.size} local SVGs.`);
} else {
  await mkdir(iconDir, { recursive: true });
  for (const [name, content] of expectedIcons) {
    await writeIfChanged(join(iconDir, name), content);
  }
  await writeIfChanged(readmePath, nextReadme);
  console.log(`Generated ${technologies.length} badges and ${expectedIcons.size} local SVGs.`);
}
