import { BICA_HOME } from '../storage';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Agent Skills (https://agentskills.io): folders holding a SKILL.md with a
// name and description. Only those two go into the instructions; the agent
// reads the file itself when a task matches, so unused skills cost little.

export interface Skill {
  name: string;
  description: string;
  path: string;
}

/** Earlier folders win when two skills share a name: project over user. */
function skillDirs(cwd: string) {
  const home = homedir();
  return [
    join(cwd, '.agents/skills'),
    join(cwd, '.claude/skills'),
    join(cwd, '.bica/skills'),
    join(home, '.agents/skills'),
    join(home, '.claude/skills'),
    join(BICA_HOME, 'skills'),
  ];
}

/** The keys of a SKILL.md frontmatter block; block scalars (`>`, `|`) are folded to one line. */
function frontmatter(text: string) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields: Record<string, string> = {};
  if (!match) return fields;
  let key: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (field) {
      key = field[1];
      fields[key] = /^[>|][-+]?$/.test(field[2]) ? '' : field[2];
    } else if (key && /^\s/.test(line)) {
      fields[key] = `${fields[key]} ${line.trim()}`.trim();
    }
  }
  for (const [k, v] of Object.entries(fields))
    fields[k] = v.replace(/^(['"])(.*)\1$/, '$2');
  return fields;
}

async function readSkill(path: string): Promise<Skill | null> {
  const text = await readFile(path, 'utf8').catch(() => null);
  if (!text) return null;
  const fields = frontmatter(text);
  // The user invokes these by name; the model never picks them.
  if (fields['disable-model-invocation'] === 'true') return null;
  if (!fields.name || !fields.description) return null;
  return { name: fields.name, description: fields.description, path };
}

/** The skills visible to a session working in `cwd`. Re-read each prompt, so edits apply live. */
export async function findSkills(cwd: string): Promise<Skill[]> {
  const found = await Promise.all(
    skillDirs(cwd).map(async (dir) => {
      const entries = await readdir(dir).catch(() => []);
      return Promise.all(
        entries.map((entry) => readSkill(join(dir, entry, 'SKILL.md'))),
      );
    }),
  );
  const byName = new Map<string, Skill>();
  for (const skill of found.flat())
    if (skill && !byName.has(skill.name)) byName.set(skill.name, skill);
  return [...byName.values()];
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The skills section of the instructions, or null when there are none: the
 * Pi coding agent's text and format, plus a line for the old tool output Bica
 * clears.
 */
export async function skillsSection(cwd: string) {
  const skills = await findSkills(cwd);
  if (!skills.length) return null;
  const list = skills
    .map(
      (s) =>
        `  <skill>\n    <name>${escape(s.name)}</name>\n    <description>${escape(s.description)}</description>\n    <location>${escape(s.path)}</location>\n  </skill>`,
    )
    .join('\n');
  return `The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.
Read a skill's file again once it is gone from your context.

<available_skills>
${list}
</available_skills>`;
}
