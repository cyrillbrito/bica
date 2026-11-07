import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  RiArrowDownSLine,
  RiArrowUpLine,
  RiAttachment2,
  RiCornerDownLeftLine,
  RiGitBranchLine,
  RiMicLine,
  RiPieChart2Line,
  RiStopFill,
  RiTimeLine,
} from '@remixicon/react';
import { ComposerLoader } from '@/components/application/composer-loader/composer-loader';
import {
  Dropdown,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from '@/components/base/dropdown/dropdown';
import { cx } from '@/utils/cx';
import { ModelPicker } from './ModelPicker';
import type { Queued } from './useFakeTurn';

function RoundButton({
  label,
  onClick,
  children,
  primary = false,
  type = 'button',
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  primary?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
        primary
          ? 'bg-button-primary text-white'
          : 'bg-background-secondary-default text-foreground-icon-secondary hover:bg-background-secondary-hover',
      )}
    >
      {children}
    </button>
  );
}

/** Steering prompts and queued ones, one quiet line each above the box. */
function QueueTray({
  queue,
  onTake,
}: {
  queue: Queued[];
  onTake: (id: number) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {queue.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="mx-3 flex flex-col gap-0.5 rounded-t-2xl border border-b-0 border-border-button-default bg-background-primary-default/70 p-1.5 backdrop-blur"
        >
          {queue.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onTake(q.id)}
                title="Take back into the composer"
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-start hover:bg-background-secondary-hover"
              >
                {q.mode === 'steer' ? (
                  <RiCornerDownLeftLine
                    aria-label="Sending now"
                    className="size-4 shrink-0 text-accent-500"
                  />
                ) : (
                  <RiTimeLine
                    aria-label="Queued"
                    className="size-4 shrink-0 text-foreground-icon-tertiary"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-secondary">
                  {q.text}
                </span>
                <span className="text-caption-1-medium text-text-tertiary">
                  {q.mode === 'steer' ? 'Next' : 'Queued'}
                </span>
              </button>
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}

export function Composer({
  busy,
  queue = [],
  model,
  branch,
  placeholder = 'Ask for a change, or steer the agent',
  onSend,
  onStop,
  onTake,
}: {
  busy: boolean;
  queue?: Queued[];
  model?: string;
  branch?: string;
  placeholder?: string;
  onSend: (text: string, mode: Queued['mode']) => void;
  onStop?: () => void;
  onTake?: (id: number) => string;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const typed = text.trim().length > 0;

  const send = (mode: Queued['mode'] = 'steer') => {
    if (!typed) return;
    onSend(text.trim(), mode);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(e.metaKey || e.ctrlKey ? 'queue' : 'steer');
    }
  };

  return (
    <div className="flex w-full flex-col">
      <QueueTray
        queue={queue}
        onTake={(id) => {
          setText(onTake?.(id) ?? '');
          box.current?.focus();
        }}
      />
      <ComposerLoader active={busy} radius={24}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className={cx(
            'flex w-full flex-col gap-1 rounded-3xl p-2',
            busy ? 'bg-transparent' : 'bg-background-primary-default shadow-xs',
          )}
        >
          <label className="sr-only" htmlFor="composer">
            Prompt
          </label>
          <textarea
            id="composer"
            ref={box}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="field-sizing-content max-h-60 min-h-11 w-full resize-none bg-transparent px-2 pt-2 text-body-regular text-text-primary caret-text-primary outline-none placeholder:text-text-tertiary"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Attach an image"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ai-chat-composer-add-background text-foreground-icon-primary transition-colors hover:bg-ai-chat-composer-add-hover-background"
            >
              <RiAttachment2 aria-hidden className="size-5" />
            </button>
            <ModelPicker initial={model} />
            <div className="flex-1" />
            {!typed && !busy && (
              <RoundButton label="Start a voice call">
                <RiMicLine aria-hidden className="size-5" />
              </RoundButton>
            )}
            {!typed && busy && (
              <RoundButton label="Stop" onClick={onStop}>
                <RiStopFill aria-hidden className="size-5" />
              </RoundButton>
            )}
            {typed && !busy && (
              <RoundButton label="Send" type="submit" primary>
                <RiArrowUpLine aria-hidden className="size-5" />
              </RoundButton>
            )}
            {typed && busy && (
              <div className="flex shrink-0 items-center rounded-full bg-button-primary text-white">
                <button
                  type="submit"
                  aria-label="Send now"
                  title="Send now: joins the current run"
                  className="flex h-9 cursor-pointer items-center gap-1 ps-3 pe-2 text-body-2-medium"
                >
                  <RiArrowUpLine aria-hidden className="size-5" />
                  Send now
                </button>
                <Dropdown>
                  <DropdownTrigger
                    aria-label="Queue or stop"
                    className="flex h-9 items-center border-s border-white/25 ps-1.5 pe-2.5"
                  >
                    <RiArrowDownSLine aria-hidden className="size-4" />
                  </DropdownTrigger>
                  <DropdownPopover
                    aria-label="Queue or stop"
                    placement="top end"
                    className="w-52"
                  >
                    <DropdownItem onSelect={() => send('queue')}>
                      <RiTimeLine
                        aria-hidden
                        className="size-5 text-foreground-icon-secondary"
                      />
                      <span className="flex-1 text-start text-body-medium text-text-primary">
                        Queue
                      </span>
                      <span className="text-caption-1-medium text-text-tertiary">
                        ⌘↵
                      </span>
                    </DropdownItem>
                    <DropdownItem onSelect={onStop}>
                      <RiStopFill
                        aria-hidden
                        className="size-5 text-foreground-icon-secondary"
                      />
                      <span className="text-body-medium text-text-primary">
                        Stop
                      </span>
                    </DropdownItem>
                  </DropdownPopover>
                </Dropdown>
              </div>
            )}
          </div>
        </form>
      </ComposerLoader>
      <div className="flex h-[30px] w-full items-center justify-between px-3">
        <span className="flex min-w-0 items-center gap-1 text-body-2-medium text-text-secondary">
          <RiGitBranchLine
            aria-hidden
            className="size-4 shrink-0 text-foreground-icon-secondary"
          />
          <span className="truncate">{branch ?? 'main'}</span>
        </span>
        <span
          className="flex items-center gap-1 text-body-2-medium text-text-secondary"
          title="Context used"
        >
          <RiPieChart2Line
            aria-hidden
            className="size-4 text-foreground-icon-secondary"
          />
          34%
        </span>
      </div>
    </div>
  );
}
