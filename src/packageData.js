/**
 * @copyright   2017, Miles Johnson
 * @license     https://opensource.org/licenses/MIT
 * @flow
 */

import chalk from 'chalk';
import { emojiDataStable, emojiDataBeta, expandEmojiData } from 'unicode-emoji-data';
import emojiOneData from 'emojione/emoji.json';
import createKeywords from './createKeywords';
import createShortnames from './createShortnames';
import fromHexToCodepoint from './fromHexToCodepoint';

// Pre-poluate unicode emoji data
const EMOJI = expandEmojiData(emojiDataStable);
const BETA_EMOJI = expandEmojiData(emojiDataBeta);

// Pre-poluate a mapping of hexcodes to EmojiOne
const EMOJI_ONE = {};

Object.keys(emojiOneData).forEach((hexcode: string) => {
  EMOJI_ONE[hexcode.toUpperCase()] = emojiOneData[hexcode];
});

// Cache the results after packaging
export const CACHE = {
  stable: [],
  beta: [],
};

const WS_REGEX = /\s/g;
const JOINER_REGEX = /(-(200D|FE0F))/g;

export default function packageData(beta: boolean = false): Object[] {
  const cacheKey = beta ? 'beta' : 'stable';

  if (CACHE[cacheKey].length) {
    return CACHE[cacheKey];
  }

  (beta ? BETA_EMOJI : EMOJI).forEach((emoji: Object) => {
    // Includes ZWJ (zero width joiner) and variation selectors
    let hexcodeZWJ = (emoji.presentation && emoji.presentation.default)
      ? emoji.presentation.default
      : emoji.codepoint;

    // Omit emoji without a hexcode
    if (!hexcodeZWJ) {
      return;
    }

    // Replace spaces with dashes to match EmojiOne
    hexcodeZWJ = hexcodeZWJ.trim().replace(WS_REGEX, '-');

    // Create a literal unicode character using ZWJ based hexcodes
    const unicode = String.fromCodePoint(...fromHexToCodepoint(hexcodeZWJ));

    // Create a hexcode without ZWJ and variation selectors
    const hexcode = hexcodeZWJ.replace(JOINER_REGEX, '');

    // Package our data
    const extraEmoji = {
      hexcode,
      hexcodeZWJ,
      unicode,
      category: 'symbols',
      codepoint: fromHexToCodepoint(hexcode),
      keywords: createKeywords(emoji.name),
      shortnames: createShortnames(emoji.name),
    };

    // Inherit values from EmojiOne if they exist
    if (EMOJI_ONE[hexcode]) {
      const emojiOne = EMOJI_ONE[hexcode];
      const keywords = emojiOne.keywords.filter(kw => kw !== '');

      extraEmoji.category = emojiOne.category;

      // Remove colons for a smaller filesize
      extraEmoji.shortnames = [
        emojiOne.shortname,
        ...emojiOne.shortname_alternates,
      ].map(sn => sn.replace(/:/g, ''));

      if (keywords.length) {
        extraEmoji.keywords = keywords;
      }

      // Delete the reference so we can infer what's not been used
      delete EMOJI_ONE[hexcode];
    }

    // Cache the merged values
    CACHE[cacheKey].push({
      ...emoji,
      ...extraEmoji,
    });
  });

  // Verify all of EmojiOne has been used
  if (process.env.NODE_ENV === 'development') {
    const remainingEmojiOnes = Object.values(EMOJI_ONE);

    if (remainingEmojiOnes.length) {
      console.log(chalk.yellow('Not all EmojiOne definitions have been used!'));

      remainingEmojiOnes.forEach((emoji: *) => {
        // $FlowIgnore Object.values() is typed incorrectly
        console.log(chalk.gray(`  ${emoji.name}`));
      });
    }
  }

  return CACHE[cacheKey];
}
