import { translateRuToUkEn } from '@veloxdesk/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TranslateService {
  constructor(private readonly config: ConfigService) {}

  // Silently disabled (same convention as an unconfigured TELEGRAM_BOT_TOKEN
  // elsewhere in this codebase) when no key is set — the admin catalog forms
  // just never auto-fill the uk/en fields, no error surfaces.
  async translate(text: string): Promise<{ uk: string | null; en: string | null }> {
    const apiKey = this.config.get<string>('DEEPL_API_KEY');
    if (!apiKey) {
      return { uk: null, en: null };
    }
    return translateRuToUkEn(apiKey, text);
  }
}
