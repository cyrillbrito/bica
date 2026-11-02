import { Title } from '@solidjs/meta';
import { For, Show } from 'solid-js';

import Accounts from '../models/Accounts';
import { Card, Setting, Toggle } from '../ui/Card';
import Alert from '../ui/Alert';
import { Button } from '../ui/Button';
import ModelFavorites from '../models/ModelFavorites';
import ModelPicker from '../models/ModelPicker';
import TopBar from '../app/TopBar';
import Input from '../ui/Input';
import { toast } from '../ui/Toast';
import { Segmented, segmentClass } from '../ui/Segmented';
import {
  MODE_LABELS,
  MODES,
  mode as testMode,
  openWithTestData,
} from '../fixtures';
import { useModels } from '../models/models';
import { updateSettings, useSettings } from '../settings';
import { motion, setMotion, type Motion } from '../ui/motion';
import { setSoundOn, soundOn } from '../ui/sound';
import { setTheme, theme, type Theme } from '../ui/theme';
import { hideThinking, setHideThinking } from '../sessions/thinking';
import { useTelemetry } from '../telemetry/telemetry';
import { TELEMETRY_DOCS } from '@bica/shared/telemetry';
import type { TelemetryConfig } from '@bica/shared/protocol';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Why telemetry is off when the switch can't turn it on.
const FORCED_OFF: Partial<Record<NonNullable<TelemetryConfig['off']>, string>> =
  {
    'no-key': 'Off: this build of Bica has no PostHog key, so nothing is sent.',
    DO_NOT_TRACK: 'Off: the server runs with DO_NOT_TRACK set.',
    BICA_TELEMETRY: 'Off: the server runs with BICA_TELEMETRY=0.',
  };

const MOTIONS: { value: Motion; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
];

export default function Settings() {
  const catalog = useModels();
  const settings = useSettings();
  const telemetry = useTelemetry();
  const forcedOff = () => FORCED_OFF[telemetry()?.off ?? 'setting'];
  const hasKey = () =>
    catalog().providers.some((p) => p.id === settings().model.provider);

  return (
    <>
      <Title>Settings</Title>
      <TopBar>
        <h1 class="truncate font-semibold">Settings</h1>
      </TopBar>
      <div class="flex-1 overflow-y-auto overscroll-contain border-t border-line">
        <div class="chat-column flex flex-col gap-6 py-8">
          <Card title="Appearance" footer="Saved on this device.">
            <Setting label="Theme" hint="System follows your device.">
              <Segmented>
                <For each={THEMES}>
                  {(t) => (
                    <button
                      class={segmentClass}
                      data-on={theme() === t.value ? '' : undefined}
                      aria-pressed={theme() === t.value ? 'true' : 'false'}
                      onClick={() => setTheme(t.value)}
                    >
                      {t.label}
                    </button>
                  )}
                </For>
              </Segmented>
            </Setting>
            <Setting
              label="Motion"
              hint="System follows your device's reduce motion setting. Full animates here even when it's on."
            >
              <Segmented>
                <For each={MOTIONS}>
                  {(m) => (
                    <button
                      class={segmentClass}
                      data-on={motion() === m.value ? '' : undefined}
                      aria-pressed={motion() === m.value ? 'true' : 'false'}
                      onClick={() => setMotion(m.value)}
                    >
                      {m.label}
                    </button>
                  )}
                </For>
              </Segmented>
            </Setting>
            <Toggle
              label="Hide thinking"
              hint="Leave the model's thinking out of transcripts. Tool calls still show."
              checked={hideThinking()}
              onChange={setHideThinking}
            />
            <Toggle
              label="Sounds"
              hint={
                <>
                  A chime when a session finishes, a double tap when it asks you
                  something, a low one when it fails. During a call, Groove
                  Salad from{' '}
                  <a
                    class="underline hover:text-fg"
                    href="https://somafm.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SomaFM
                  </a>{' '}
                  while the agent works.
                </>
              }
              checked={soundOn()}
              onChange={setSoundOn}
            />
          </Card>

          <Accounts />

          <Card title="Models">
            <Show when={!hasKey()}>
              <div class="p-2">
                <Alert>
                  The default model's provider isn't connected. Add it under
                  Providers or pick another model.
                </Alert>
              </div>
            </Show>
            <Setting
              label="New sessions"
              hint={
                <>
                  The model and effort a session starts with.
                  <Show when={settings().fromEnv.model}>
                    {' '}
                    Not picked yet: using <code>PI_MODEL</code> from the
                    environment.
                  </Show>
                </>
              }
            >
              <ModelPicker
                provider
                value={{
                  model: settings().model,
                  thinkingLevel: settings().thinkingLevel,
                }}
                onChange={(choice) => void updateSettings(choice)}
              />
            </Setting>
            <Setting
              label="Fast model"
              hint={
                <>
                  A small, cheap model that titles sessions and drafts commit
                  messages. Without one, titles are the prompt's first words.
                  <Show when={settings().fromEnv.fastModel}>
                    {' '}
                    Using <code>PI_FAST_MODEL</code> from the environment.
                  </Show>
                </>
              }
            >
              <ModelPicker
                provider
                effort={false}
                empty="None"
                value={
                  settings().fastModel
                    ? {
                        model: settings().fastModel!,
                        thinkingLevel: 'off',
                      }
                    : undefined
                }
                onChange={(c) => void updateSettings({ fastModel: c.model })}
              />
              <Show when={settings().fastModel}>
                <Button
                  size="sm"
                  onClick={() => void updateSettings({ fastModel: null })}
                >
                  Clear
                </Button>
              </Show>
            </Setting>
            <Toggle
              label="Keep the cache for an hour"
              hint="The context stays cached through breaks of up to an hour instead of 5 minutes, so coming back doesn't resend it all. Cache writes cost 2x input instead of 1.25x. Some OpenAI models keep it 24 hours instead."
              checked={settings().longCache}
              onChange={(on) => void updateSettings({ longCache: on })}
            />
          </Card>

          <ModelFavorites />

          <div id="hub">
            <Card
              title="Hub"
              description="The session that coordinates the others."
            >
              <Setting
                label="Hub folder"
                hint="Where the hub keeps its memory files, such as a folder in your notes vault. It starts once this is set."
              >
                <Input
                  class="h-8 w-64 max-w-full touch:h-11"
                  placeholder="~/Vault/Hub"
                  aria-label="Hub folder"
                  value={settings().hubFolder ?? ''}
                  onChange={(e) =>
                    void updateSettings({
                      hubFolder: e.currentTarget.value || null,
                    }).catch((error: unknown) => toast.error(error))
                  }
                />
              </Setting>
              <Setting
                label="Model"
                hint="Unset, it runs Claude Sonnet 5.5 through Anthropic at low effort."
              >
                <ModelPicker
                  provider
                  empty="Unset"
                  value={settings().hubModel ?? undefined}
                  onChange={(hubModel) => void updateSettings({ hubModel })}
                />
                <Show when={settings().hubModel}>
                  <Button
                    size="sm"
                    onClick={() => void updateSettings({ hubModel: null })}
                  >
                    Clear
                  </Button>
                </Show>
              </Setting>
            </Card>
          </div>

          <Card title="Behavior">
            <Setting
              label="Night runs start at"
              hint="Sessions held for tonight start one at a time from then, for 5 hours, while the plan has 20% of its week left. Pick a time at least 5 hours before your day starts, so its window is fresh."
            >
              <Input
                type="time"
                class="h-7"
                value={settings().nightStart}
                onChange={(e) =>
                  void updateSettings({
                    nightStart: e.currentTarget.value,
                  }).catch((error) => toast.error(error))
                }
              />
            </Setting>
            <Toggle
              label="Stage on view"
              hint="Opening a diff under Changes stages the file. Staged is what you reviewed; whatever the agent writes after shows up under Changes again."
              checked={settings().stageOnView}
              onChange={(on) => void updateSettings({ stageOnView: on })}
            />
          </Card>

          <Card
            title="Telemetry"
            footer={
              <>
                <Show when={forcedOff()}>{(why) => <>{why()} </>}</Show>
                <a
                  class="underline hover:text-fg"
                  href={TELEMETRY_DOCS}
                  target="_blank"
                  rel="noreferrer"
                >
                  What's sent, and what never is
                </a>
              </>
            }
          >
            <Toggle
              label="Usage data and errors"
              hint="Counts and timings of what you use in Bica, and its own crashes, to see what to fix and build next. Never your prompts, code, file names, or paths."
              checked={settings().telemetry && !forcedOff()}
              disabled={!!forcedOff()}
              onChange={(on) => void updateSettings({ telemetry: on })}
            />
            <Toggle
              label="Screen recordings"
              hint="Recordings of the app with every text, input, and image hidden, to see where it gets in the way. Only with usage data on."
              checked={
                settings().replays && settings().telemetry && !forcedOff()
              }
              disabled={!!forcedOff() || !settings().telemetry}
              onChange={(on) => void updateSettings({ replays: on })}
            />
          </Card>

          <Show when={import.meta.env.DEV}>
            <Card
              title="Test data"
              description="Reopens Bica on made-up data, to see how screens hold up with long names, huge lists, or nothing at all. Real sessions are left alone, and commands aren't sent. Only in development, for this tab."
              bare={
                <div class="px-2 pb-2">
                  <Segmented class="self-start">
                    <For each={[undefined, ...MODES]}>
                      {(m) => (
                        <button
                          class={segmentClass}
                          data-on={testMode() === m ? '' : undefined}
                          aria-pressed={testMode() === m ? 'true' : 'false'}
                          onClick={() => openWithTestData(m)}
                        >
                          {m ? MODE_LABELS[m] : 'Off'}
                        </button>
                      )}
                    </For>
                  </Segmented>
                </div>
              }
            />
          </Show>
        </div>
      </div>
    </>
  );
}
