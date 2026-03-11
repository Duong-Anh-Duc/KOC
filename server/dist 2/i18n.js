"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.i18nMiddleware = void 0;
const i18next_1 = __importDefault(require("i18next"));
const i18next_http_middleware_1 = __importDefault(require("i18next-http-middleware"));
const en_json_1 = __importDefault(require("./locales/en.json"));
const vi_json_1 = __importDefault(require("./locales/vi.json"));
i18next_1.default.use(i18next_http_middleware_1.default.LanguageDetector).init({
    resources: {
        en: { translation: en_json_1.default },
        vi: { translation: vi_json_1.default },
    },
    fallbackLng: 'vi',
    preload: ['en', 'vi'],
    detection: {
        order: ['header'],
        lookupHeader: 'accept-language',
    },
    interpolation: {
        escapeValue: false,
    },
});
exports.i18nMiddleware = i18next_http_middleware_1.default.handle(i18next_1.default);
exports.default = i18next_1.default;
//# sourceMappingURL=i18n.js.map