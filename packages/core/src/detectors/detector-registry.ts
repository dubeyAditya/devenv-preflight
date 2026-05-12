import type { ToolDetector } from '../types/types.js';
import { nodeDetector } from './node-detector.js';
import { pythonDetector } from './python-detector.js';
import { javaDetector } from './java-detector.js';
import { npmDetector } from './npm-detector.js';
import { brewDetector } from './brew-detector.js';
import { gitDetector } from './git-detector.js';

export const ALL_DETECTORS: readonly ToolDetector[] = [
  nodeDetector,
  pythonDetector,
  javaDetector,
  npmDetector,
  brewDetector,
  gitDetector,
];
