import 'server-only';
import type {
  AssistantImages,
  ImageApi,
  ImageModel,
  ImagesContext,
  ImagesOptions,
  ProviderImages,
} from '@earendil-works/pi-ai';

/*
 * OpenAI's Images API, as CLIProxyAPI serves it for gpt-image on a ChatGPT
 * plan (docs/proxy.md). pi-ai only ships OpenRouter's image API, which goes
 * through chat completions. A prompt alone goes to /images/generations; with
 * reference images it goes to /images/edits, as JSON with data URLs.
 */

export const OPENAI_IMAGES = 'openai-images';

interface ImagesResponse {
  data?: { b64_json?: string; revised_prompt?: string }[];
  output_format?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

async function generateImages(
  model: ImageModel<ImageApi>,
  context: ImagesContext,
  options?: ImagesOptions,
): Promise<AssistantImages> {
  const result: AssistantImages = {
    api: model.api,
    provider: model.provider,
    model: model.id,
    output: [],
    stopReason: 'stop',
    timestamp: Date.now(),
  };
  try {
    if (!options?.apiKey)
      throw new Error(`No API key for provider: ${model.provider}`);
    const prompt = context.input
      .flatMap((item) => (item.type === 'text' ? [item.text] : []))
      .join('\n\n');
    const images = context.input.flatMap((item) =>
      item.type === 'image'
        ? [{ image_url: `data:${item.mimeType};base64,${item.data}` }]
        : [],
    );
    const res = await (options.fetch ?? fetch)(
      `${model.baseUrl}/images/${images.length ? 'edits' : 'generations'}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.id,
          prompt,
          ...(images.length && { images }),
        }),
        signal: options.signal,
      },
    );
    const body = (await res.json().catch(() => ({}))) as ImagesResponse;
    if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    const mimeType = `image/${body.output_format === 'jpeg' ? 'jpeg' : (body.output_format ?? 'png')}`;
    for (const item of body.data ?? []) {
      if (item.revised_prompt)
        result.output.push({ type: 'text', text: item.revised_prompt });
      if (item.b64_json)
        result.output.push({ type: 'image', mimeType, data: item.b64_json });
    }
    if (!result.output.some((block) => block.type === 'image'))
      throw new Error('The response held no image');
    const input = body.usage?.input_tokens ?? 0;
    const output = body.usage?.output_tokens ?? 0;
    const cost = {
      input: (model.cost.input / 1e6) * input,
      output: (model.cost.output / 1e6) * output,
      cacheRead: 0,
      cacheWrite: 0,
    };
    result.usage = {
      input,
      output,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: input + output,
      cost: { ...cost, total: cost.input + cost.output },
    };
  } catch (error) {
    result.stopReason = options?.signal?.aborted ? 'aborted' : 'error';
    result.errorMessage =
      error instanceof Error ? error.message : String(error);
  }
  return result;
}

export const openAIImagesApi: ProviderImages = { generateImages };
