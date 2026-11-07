import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RadioGroup } from 'react-aria-components';
import {
  RiArrowRightSLine,
  RiBrainLine,
  RiCheckLine,
  RiEditLine,
  RiErrorWarningLine,
  RiFileCopyLine,
  RiFileTextLine,
  RiGitForkLine,
  RiGlobalLine,
  RiLoader4Line,
  RiMessage2Line,
  RiQuestionLine,
  RiSearchLine,
  RiTerminalLine,
} from '@remixicon/react';
import { AgentThinking } from '@/components/application/agent-thinking/agent-thinking';
import { Button } from '@/components/base/buttons/button';
import { RadioCard } from '@/components/base/radio/radio-card';
import type { Ask, Row, Tool } from '@/fixtures';
import { cx } from '@/utils/cx';
import { Markdown } from './Markdown';

const TOOL_ICON: Record<Tool['name'], typeof RiTerminalLine> = {
  bash: RiTerminalLine,
  read: RiFileTextLine,
  edit: RiEditLine,
  write: RiEditLine,
  grep: RiSearchLine,
  web_search: RiGlobalLine,
};

function seconds(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** BoardUI's user turn: a white card at the end of the line. */
function Prompt({ text }: { text: string }) {
  return (
    <p className="ms-auto w-fit max-w-[85%] rounded-2xl bg-background-primary-default px-3 py-[11px] text-body-regular break-words whitespace-pre-wrap text-text-primary shadow-card sm:max-w-[75%]">
      {text}
    </p>
  );
}

function ActionButton({
  label,
  icon: I,
  onClick,
}: {
  label: string;
  icon: typeof RiFileCopyLine;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary transition-colors hover:bg-background-primary-default hover:text-foreground-icon-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:outline-none"
    >
      <I aria-hidden className="size-4" />
    </button>
  );
}

function Reply({ text, streaming }: { text: string; streaming: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group/message flex flex-col gap-1 px-1">
      <Markdown text={text} streaming={streaming} />
      <div
        className={cx(
          'flex items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100',
          !streaming && 'group-hover/message:opacity-100',
        )}
      >
        <ActionButton
          label={copied ? 'Copied' : 'Copy'}
          icon={copied ? RiCheckLine : RiFileCopyLine}
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        />
        <ActionButton label="Fork from here" icon={RiGitForkLine} />
      </div>
    </div>
  );
}

function ToolRow({ tool, running }: { tool: Tool; running: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICON[tool.name];
  return (
    <li className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group/tool flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-start hover:bg-background-primary-default"
      >
        {running ? (
          <RiLoader4Line
            aria-label="Running"
            className="size-4 shrink-0 animate-spin text-accent-500"
          />
        ) : (
          <Icon
            aria-hidden
            className={cx(
              'size-4 shrink-0',
              tool.failed ? 'text-rose-500' : 'text-foreground-icon-tertiary',
            )}
          />
        )}
        <span className="shrink-0 text-body-2-medium text-text-secondary">
          {tool.name}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-text-tertiary">
          {tool.target}
        </span>
        {tool.diff && !running && (
          <span className="shrink-0 font-mono text-caption-1-medium">
            <span className="text-lime-600">+{tool.diff[0]}</span>{' '}
            <span className="text-rose-500">−{tool.diff[1]}</span>
          </span>
        )}
        {tool.failed ? (
          <span className="shrink-0 text-caption-1-medium text-rose-500">
            Failed
          </span>
        ) : (
          !running && (
            <span className="shrink-0 text-caption-1-regular text-text-tertiary tabular-nums">
              {seconds(tool.ms)}
            </span>
          )
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre className="ms-7 mt-1 mb-2 max-h-60 overflow-auto rounded-xl border border-border-button-default bg-background-primary-default p-2.5 font-mono text-[12.5px] leading-5 text-text-secondary">
              {tool.output.split('\n').map((line, i) => (
                <div
                  key={i}
                  className={cx(
                    line.startsWith('+ ') && 'text-lime-600',
                    line.startsWith('- ') && 'text-rose-500',
                  )}
                >
                  {line || ' '}
                </div>
              ))}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Thinking and tool calls between two replies, folded into one list. */
function Activity({
  row,
  live,
}: {
  row: Extract<Row, { kind: 'activity' }>;
  live: boolean;
}) {
  const [open, setOpen] = useState(live);
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const count = row.tools.length;
  const summary = [
    `${count} tool${count === 1 ? '' : 's'}`,
    row.thought && '1 thought',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <div className="flex flex-col gap-1 px-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-fit cursor-pointer items-center gap-1 rounded-lg py-0.5 pe-1.5 text-body-2-medium text-text-secondary hover:text-text-primary"
      >
        <RiArrowRightSLine
          aria-hidden
          className={cx(
            'size-4 transition-transform duration-200 rtl:-scale-x-100',
            open && 'rotate-90',
          )}
        />
        {live ? summary : `Worked for ${row.seconds}s · ${summary}`}
      </button>
      {open && (
        <ul className="ms-2 flex flex-col gap-0.5 border-s border-separator-border ps-2">
          {row.thought && (
            <li className="flex flex-col">
              <button
                type="button"
                onClick={() => setThoughtOpen(!thoughtOpen)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-start hover:bg-background-primary-default"
              >
                <RiBrainLine
                  aria-hidden
                  className="size-4 shrink-0 text-foreground-icon-tertiary"
                />
                <span className="text-body-2-medium text-text-secondary">
                  Thought
                </span>
                <span
                  className={cx(
                    'min-w-0 flex-1 text-body-2-regular text-text-tertiary',
                    !thoughtOpen && 'truncate',
                  )}
                >
                  {row.thought}
                </span>
              </button>
            </li>
          )}
          {row.tools.map((tool, i) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              running={live && i === row.tools.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The agent's `ask`: one question, picked from options or written out. */
function AskCard({ ask }: { ask: Ask }) {
  const [choice, setChoice] = useState<string>('');
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4 shadow-card">
      <div className="flex items-start gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-status-yellow-background text-status-yellow-text">
          <RiQuestionLine aria-hidden className="size-4" />
        </span>
        <div className="flex flex-col">
          <span className="text-caption-1-medium text-text-tertiary">
            The agent asks
          </span>
          <p className="text-body-medium text-text-primary">{ask.question}</p>
        </div>
      </div>
      <RadioGroup
        aria-label={ask.question}
        value={choice}
        onChange={setChoice}
        isDisabled={sent}
        className="flex flex-col gap-2"
      >
        {ask.options.map((o) => (
          <RadioCard
            key={o.label}
            value={o.label}
            title={o.label}
            description={o.description}
          />
        ))}
      </RadioGroup>
      <div className="flex items-center justify-end gap-2">
        {sent ? (
          <span className="flex items-center gap-1 text-body-2-medium text-text-secondary">
            <RiCheckLine aria-hidden className="size-4 text-lime-600" />
            Answered: {choice}
          </span>
        ) : (
          <>
            <Button variant="ghost" size="small">
              Write my own
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={!choice}
              onClick={() => setSent(true)}
            >
              Answer
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Note({ from, text }: { from: string; text: string }) {
  return (
    <div className="flex items-start gap-2 px-1 text-body-2-regular text-text-secondary">
      <RiMessage2Line
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-foreground-icon-tertiary"
      />
      <p>
        <span className="text-body-2-medium text-text-primary">{from}</span>{' '}
        {text}
      </p>
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-2xl bg-status-rose-background p-3 text-body-2-regular text-status-rose-text"
    >
      <RiErrorWarningLine aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{text}</p>
      <Button variant="secondary" size="xs">
        Retry
      </Button>
    </div>
  );
}

export function Transcript({
  rows,
  streaming,
  working,
}: {
  rows: Row[];
  /** The last row is still arriving. */
  streaming: boolean;
  /** The working line's phrase while a run is on, or null. */
  working: string | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-10">
      {rows.map((row, i) => {
        const last = i === rows.length - 1 && streaming;
        switch (row.kind) {
          case 'prompt':
            return <Prompt key={i} text={row.text} />;
          case 'reply':
            return <Reply key={i} text={row.text} streaming={last} />;
          case 'activity':
            return <Activity key={i} row={row} live={last} />;
          case 'ask':
            return <AskCard key={i} ask={row.ask} />;
          case 'note':
            return <Note key={i} from={row.from} text={row.text} />;
          case 'error':
            return <ErrorRow key={i} text={row.text} />;
        }
      })}
      {working && (
        <AgentThinking
          variant="wave"
          label={working}
          showTimer
          className="px-1"
        />
      )}
    </div>
  );
}
