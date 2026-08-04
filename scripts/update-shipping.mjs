#!/usr/bin/env node
/**
 * Rewrites the block between <!-- shipping:start --> and <!-- shipping:end -->
 * in README.md using live data from the npm registry and the GitHub API.
 *
 * No dependencies. Node 18+ (global fetch).
 * Run locally with:  node scripts/update-shipping.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const README = fileURLToPath(new URL('../README.md', import.meta.url));
const START = '<!-- shipping:start -->';
const END = '<!-- shipping:end -->';

/** Add a project here and it shows up in the table. That's the whole config. */
const PROJECTS = [
    {
        title: 'session-steward',
        repo: 'mallikcheripally/session-steward',
        npm: 'session-steward',
        blurb:
            'Local session manager for Codex and Claude Code — keeps context, history and state ' +
            'where you can actually see it',
    },
    {
        title: 'colore-js',
        repo: 'mallikcheripally/colore-js',
        npm: 'colore-js',
        blurb:
            'Color toolkit: conversion across every CSS format, manipulation, harmony generation, ' +
            'and contrast/accessibility analysis',
    },
    {
        title: 'deep-equal-js',
        repo: 'mallikcheripally/deep-equal-js',
        npm: 'deep-equal-js',
        blurb: 'Deep equality checks, written for the hot path',
    },
    {
        title: 'react-refocus',
        repo: 'mallikcheripally/react-refocus',
        npm: 'react-refocus',
        blurb: 'Focus management for React — keyboard navigation and a11y primitives that don\'t fight the DOM',
    },
];

const headers = {
    'user-agent': 'mallikcheripally-profile-readme',
    ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function json(url) {
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

const compact = (n) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

async function signals(project) {
    const bits = [];

    if (project.npm) {
        const [meta, dl] = await Promise.all([
            json(`https://registry.npmjs.org/${project.npm}/latest`),
            json(`https://api.npmjs.org/downloads/point/last-month/${project.npm}`),
        ]);
        if (meta?.version) bits.push(`\`v${meta.version}\``);
        if (dl?.downloads > 0) bits.push(`${compact(dl.downloads)} downloads/mo`);
    }

    if (project.repo) {
        const repo = await json(`https://api.github.com/repos/${project.repo}`);
        // a small star count reads worse than none
        if (repo?.stargazers_count >= 10) bits.push(`★ ${compact(repo.stargazers_count)}`);
    }

    return bits.length ? bits.join(' · ') : project.fallback ?? '';
}

function link(project) {
    return project.repo
        ? `**[${project.title}](https://github.com/${project.repo})**`
        : `**${project.title}**`;
}

const rows = await Promise.all(
    PROJECTS.map(async (p) => `| ${link(p)} | ${p.blurb} | ${await signals(p)} |`),
);

const table = ['| Project | What it is | |', '| :-- | :-- | :-- |', ...rows].join('\n');

const readme = await readFile(README, 'utf8');
const before = readme.indexOf(START);
const after = readme.indexOf(END);

if (before === -1 || after === -1) {
    console.error(`Could not find ${START} / ${END} markers in README.md`);
    process.exit(1);
}

const next = readme.slice(0, before + START.length) + '\n' + table + '\n' + readme.slice(after);

if (next === readme) {
    console.log('No change.');
} else {
    await writeFile(README, next);
    console.log('README.md updated.');
}
