import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { RiFolder3Line } from '@remixicon/react';
import { Select, SelectItem } from '@/components/base/select/select';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/base/segmented-control/segmented-control';
import { Page } from '@/app/Page';
import { PROJECTS } from '@/fixtures';
import { Composer } from './Composer';

/** The composer and nothing else, with where the session runs below it. */
export function HomePage() {
  const navigate = useNavigate();
  const [project, setProject] = useState('bica');
  const [where, setWhere] = useState('main');
  return (
    <Page title="New session" bodyClassName="flex flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-3 py-10 sm:px-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-title-2-medium text-text-primary">
            What should we build?
          </h2>
          <p className="text-body-regular text-text-secondary">
            The first prompt starts the session. The fast model names it.
          </p>
        </div>
        <Composer
          busy={false}
          placeholder="Describe the change"
          branch={where === 'main' ? 'main' : 'new worktree'}
          onSend={() =>
            void navigate({ to: '/s/$id', params: { id: 'mock-ui' } })
          }
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Select
            aria-label="Project"
            selectedKey={project}
            onSelectionChange={(key) => setProject(String(key))}
            size="sm"
            className="w-44"
            renderValue={() => (
              <span className="flex items-center gap-1.5">
                <RiFolder3Line
                  aria-hidden
                  className="size-4 text-foreground-icon-secondary"
                />
                {PROJECTS.find((p) => p.id === project)?.name}
              </span>
            )}
          >
            {PROJECTS.map((p) => (
              <SelectItem key={p.id} id={p.id} textValue={p.name}>
                {p.name}
              </SelectItem>
            ))}
            <SelectItem id="chat" textValue="New chat">
              New chat
            </SelectItem>
          </Select>
          <SegmentedControl
            aria-label="Where it runs"
            selectedKeys={[where]}
            onSelectionChange={(keys) => {
              const [key] = [...keys];
              if (key) setWhere(String(key));
            }}
          >
            <SegmentedControlItem id="main">Main folder</SegmentedControlItem>
            <SegmentedControlItem id="worktree">
              New worktree
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>
    </Page>
  );
}
