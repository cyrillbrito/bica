import { useState } from 'react';
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiSparklingLine,
} from '@remixicon/react';
import {
  Dropdown,
  DropdownDivider,
  DropdownGroup,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from '@/components/base/dropdown/dropdown';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/base/segmented-control/segmented-control';
import { Switch } from '@/components/base/switch/switch';
import { MODELS, type Model } from '@/fixtures';
import { cx } from '@/utils/cx';

/** Models by name, with Thinking and Effort where the model has them. */
export function ModelPicker({
  initial = 'Opus',
  className,
}: {
  initial?: string;
  className?: string;
}) {
  const [model, setModel] = useState<Model>(
    MODELS.find((m) => m.short === initial) ?? MODELS[0]!,
  );
  const [thinking, setThinking] = useState(true);
  const [effort, setEffort] = useState('medium');
  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={`Model: ${model.name}`}
        className={cx(
          'flex h-8 shrink-0 items-center gap-1 rounded-xl px-2 text-body-2-medium text-text-secondary transition-colors hover:bg-background-secondary-hover',
          className,
        )}
      >
        <RiSparklingLine
          aria-hidden
          className="size-4 shrink-0 text-foreground-icon-secondary"
        />
        <span className="max-w-[13ch] truncate">{model.short}</span>
        {model.thinking && thinking && (
          <span className="hidden text-text-tertiary sm:inline">
            · {effort}
          </span>
        )}
        <RiArrowDownSLine aria-hidden className="size-4 shrink-0" />
      </DropdownTrigger>
      <DropdownPopover
        aria-label="Pick a model"
        placement="top start"
        className="w-[300px]"
      >
        <DropdownGroup label="Models">
          {MODELS.map((m) => (
            <DropdownItem
              key={m.id}
              selected={m.id === model.id}
              onSelect={() => setModel(m)}
            >
              <span className="flex min-w-0 flex-1 flex-col text-start">
                <span className="text-body-medium text-text-primary">
                  {m.name}
                </span>
                <span className="text-caption-1-regular text-text-tertiary">
                  {m.provider} · {m.context} context · {m.price}
                </span>
              </span>
              {m.id === model.id && (
                <RiCheckLine
                  aria-hidden
                  className="size-4 shrink-0 text-accent-500"
                />
              )}
            </DropdownItem>
          ))}
        </DropdownGroup>
        {model.thinking && (
          <>
            <DropdownDivider />
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-body-medium text-text-primary">
                Thinking
              </span>
              <Switch
                size="sm"
                aria-label="Thinking"
                isSelected={thinking}
                onChange={setThinking}
              />
            </div>
            {thinking && (
              <div className="flex flex-col gap-1.5 px-2 pb-1">
                <span className="text-body-2-medium text-text-secondary">
                  Effort
                </span>
                <SegmentedControl
                  aria-label="Effort"
                  selectedKeys={[effort]}
                  onSelectionChange={(keys) => {
                    const [key] = [...keys];
                    if (key) setEffort(String(key));
                  }}
                  className="w-full"
                >
                  <SegmentedControlItem id="low">Low</SegmentedControlItem>
                  <SegmentedControlItem id="medium">
                    Medium
                  </SegmentedControlItem>
                  <SegmentedControlItem id="high">High</SegmentedControlItem>
                </SegmentedControl>
              </div>
            )}
          </>
        )}
      </DropdownPopover>
    </Dropdown>
  );
}
