import { defineExtension } from '@earendil-works/pi-durable';
import {
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
} from '@earendil-works/pi-durable/tools';
import { bunImages } from './fit-image';

function read() {
  return createReadTool({ images: bunImages });
}

export const CodingTools = defineExtension({
  name: 'coding-tools',
  tools: [read(), createWriteTool(), createEditTool(), createBashTool()],
});
