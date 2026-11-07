// Port of BoardUI's utils/cx.ts (MIT): tailwind-merge taught the composite
// type utilities from typography.css, so `text-body-medium` and a text color
// in one class list don't knock each other out.
import { extendTailwindMerge } from 'tailwind-merge';

const families = [
  'large-title',
  'display-1',
  'display-2',
  'display-3',
  'display-4',
  'title-1',
  'title-2',
  'title-3',
  'headline',
  'body',
  'body-2',
  'caption-1',
  'caption-2',
];
const weights = ['regular', 'medium', 'semibold', 'bold'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: families.flatMap((f) => weights.map((w) => `${f}-${w}`)) },
      ],
    },
  },
});

type Part = string | false | null | undefined | 0;

/** Merge Tailwind classes; the last of two conflicting utilities wins. */
export const cx = (...parts: Part[]) => twMerge(...parts);
