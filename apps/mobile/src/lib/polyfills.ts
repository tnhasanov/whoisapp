/**
 * Intl features the message catalogues need (plural rules) that the Hermes
 * engine may lack. Each polyfill installs itself only when the platform's own
 * implementation is missing, and only English, Azerbaijani and Russian data
 * is bundled.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- polyfills load conditionally */
import { shouldPolyfill as shouldPolyfillCanonical } from "@formatjs/intl-getcanonicallocales/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillLocale } from "@formatjs/intl-locale/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillPlural } from "@formatjs/intl-pluralrules/should-polyfill.js";

if (shouldPolyfillCanonical()) require("@formatjs/intl-getcanonicallocales/polyfill.js");
if (shouldPolyfillLocale()) require("@formatjs/intl-locale/polyfill.js");
if (shouldPolyfillPlural("en") || shouldPolyfillPlural("az") || shouldPolyfillPlural("ru")) {
  require("@formatjs/intl-pluralrules/polyfill-force.js");
  require("@formatjs/intl-pluralrules/locale-data/en.js");
  require("@formatjs/intl-pluralrules/locale-data/az.js");
  require("@formatjs/intl-pluralrules/locale-data/ru.js");
}
