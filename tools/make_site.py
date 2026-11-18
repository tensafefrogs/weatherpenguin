#!/usr/bin/env python3
"""The website's home page in every App Store language, and the sitemap.

Writes web/index.html (English) and web/<slug>/index.html for each language in app/ios/store/l10n/, from the same
text as the App Store page (listing.json and l10n/<locale>.json: subtitle, promotional text, description), plus the
few labels below. Also writes web/sitemap.xml (with each page's other languages) and web/robots.txt.
Edit this file, not the pages; then run:  python3 -I tools/make_site.py
"""
import datetime, html, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = os.path.join(ROOT, 'app', 'ios', 'store')
WEB = os.path.join(ROOT, 'web')
SITE = 'https://weatherpenguin.com'
APP_STORE = 'https://apps.apple.com/app/id713690248'

# App Store locale: (folder, hreflang, the app's language table for the demo, og:locale, the language's own name)
LANGUAGES = {
    'en-US': ('', 'en', 'en', 'en_US', 'English'),
    'da': ('da', 'da', 'da', 'da_DK', 'Dansk'),
    'de-DE': ('de', 'de', 'de', 'de_DE', 'Deutsch'),
    'es-ES': ('es', 'es-ES', 'es', 'es_ES', 'Español (España)'),
    'es-MX': ('es-mx', 'es-MX', 'es', 'es_MX', 'Español (México)'),
    'fr-FR': ('fr', 'fr', 'fr', 'fr_FR', 'Français'),
    'it': ('it', 'it', 'it', 'it_IT', 'Italiano'),
    'nl-NL': ('nl', 'nl', 'nl', 'nl_NL', 'Nederlands'),
    'no': ('no', 'nb', 'nb', 'nb_NO', 'Norsk'),
    'pl': ('pl', 'pl', 'pl', 'pl_PL', 'Polski'),
    'pt-BR': ('pt-br', 'pt-BR', 'pt', 'pt_BR', 'Português (Brasil)'),
    'pt-PT': ('pt-pt', 'pt-PT', 'pt', 'pt_PT', 'Português (Portugal)'),
    'fi': ('fi', 'fi', 'fi', 'fi_FI', 'Suomi'),
    'sv': ('sv', 'sv', 'sv', 'sv_SE', 'Svenska'),
    'ru': ('ru', 'ru', 'ru', 'ru_RU', 'Русский'),
    'ja': ('ja', 'ja', 'ja', 'ja_JP', '日本語'),
    'ko': ('ko', 'ko', 'ko', 'ko_KR', '한국어'),
    'zh-Hans': ('zh-hans', 'zh-Hans', 'zh', 'zh_CN', '简体中文'),
    'zh-Hant': ('zh-hant', 'zh-Hant', 'zh-Hant', 'zh_TW', '繁體中文'),
}

# The page's own labels: Features, Languages, Try:, the four sample weathers, the footer links (those pages are in
# English), and the line under the badge. Machine translations; a native speaker's read-through is welcome.
LABELS = {
    'en-US': ['Features', 'Languages', 'Try:', 'rain', 'cold', 'warm', 'hot', 'Support', 'Privacy', 'Terms', 'Free for iPhone, iPad and Apple Watch'],
    'da': ['Funktioner', 'Sprog', 'Prøv:', 'regn', 'koldt', 'lunt', 'varmt', 'Support', 'Privatliv', 'Vilkår', 'Gratis til iPhone, iPad og Apple Watch'],
    'de-DE': ['Funktionen', 'Sprachen', 'Probier’s aus:', 'Regen', 'kalt', 'warm', 'heiß', 'Support', 'Datenschutz', 'Nutzungsbedingungen', 'Kostenlos für iPhone, iPad und Apple Watch'],
    'es-ES': ['Funciones', 'Idiomas', 'Prueba:', 'lluvia', 'frío', 'templado', 'calor', 'Soporte', 'Privacidad', 'Condiciones', 'Gratis para iPhone, iPad y Apple Watch'],
    'es-MX': ['Funciones', 'Idiomas', 'Prueba:', 'lluvia', 'frío', 'templado', 'calor', 'Soporte', 'Privacidad', 'Términos', 'Gratis para iPhone, iPad y Apple Watch'],
    'fr-FR': ['Fonctionnalités', 'Langues', 'Essayez :', 'pluie', 'froid', 'doux', 'chaud', 'Assistance', 'Confidentialité', 'Conditions', 'Gratuit pour iPhone, iPad et Apple Watch'],
    'it': ['Funzioni', 'Lingue', 'Prova:', 'pioggia', 'freddo', 'mite', 'caldo', 'Assistenza', 'Privacy', 'Termini', 'Gratis per iPhone, iPad e Apple Watch'],
    'nl-NL': ['Functies', 'Talen', 'Probeer:', 'regen', 'koud', 'zacht', 'heet', 'Support', 'Privacy', 'Voorwaarden', 'Gratis voor iPhone, iPad en Apple Watch'],
    'no': ['Funksjoner', 'Språk', 'Prøv:', 'regn', 'kaldt', 'mildt', 'varmt', 'Støtte', 'Personvern', 'Vilkår', 'Gratis for iPhone, iPad og Apple Watch'],
    'pl': ['Funkcje', 'Języki', 'Wypróbuj:', 'deszcz', 'zimno', 'ciepło', 'upał', 'Pomoc', 'Prywatność', 'Warunki', 'Za darmo na iPhone’a, iPada i Apple Watch'],
    'pt-BR': ['Recursos', 'Idiomas', 'Experimente:', 'chuva', 'frio', 'ameno', 'calor', 'Suporte', 'Privacidade', 'Termos', 'Grátis para iPhone, iPad e Apple Watch'],
    'pt-PT': ['Funcionalidades', 'Idiomas', 'Experimente:', 'chuva', 'frio', 'ameno', 'calor', 'Suporte', 'Privacidade', 'Termos', 'Grátis para iPhone, iPad e Apple Watch'],
    'fi': ['Ominaisuudet', 'Kielet', 'Kokeile:', 'sade', 'kylmä', 'lämmin', 'helle', 'Tuki', 'Tietosuoja', 'Ehdot', 'Ilmainen iPhonelle, iPadille ja Apple Watchille'],
    'sv': ['Funktioner', 'Språk', 'Prova:', 'regn', 'kallt', 'milt', 'varmt', 'Support', 'Integritet', 'Villkor', 'Gratis för iPhone, iPad och Apple Watch'],
    'ru': ['Возможности', 'Языки', 'Попробуйте:', 'дождь', 'холодно', 'тепло', 'жарко', 'Поддержка', 'Конфиденциальность', 'Условия', 'Бесплатно для iPhone, iPad и Apple Watch'],
    'ja': ['機能', '言語', '試してみる：', '雨', '寒い', '暖かい', '暑い', 'サポート', 'プライバシー', '利用規約', 'iPhone、iPad、Apple Watch用、無料'],
    'ko': ['기능', '언어', '체험해 보세요:', '비', '추움', '따뜻함', '더움', '지원', '개인정보', '이용약관', 'iPhone, iPad, Apple Watch용 무료'],
    'zh-Hans': ['功能', '语言', '试试：', '雨', '冷', '暖', '热', '支持', '隐私', '条款', '适用于 iPhone、iPad 和 Apple Watch，免费'],
    'zh-Hant': ['功能', '語言', '試試：', '雨', '冷', '暖', '熱', '支援', '隱私', '條款', '適用於 iPhone、iPad 和 Apple Watch，免費'],
}
LABEL_KEYS = ['features', 'languages', 'try', 'rain', 'cold', 'warm', 'hot', 'support', 'privacy', 'terms', 'free']
# the original 2013 line on the English page; other languages use their description's first line
ENGLISH_PITCH = 'Weather Penguin is a cute, simple way to see what to wear today.'


def text(locale):
    if locale == 'en-US':
        l = json.load(open(os.path.join(STORE, 'listing.json')))
        return {'subtitle': l['app_info']['subtitle'], **{k: l['version'][k] for k in ('promotional_text', 'description')}}
    return json.load(open(os.path.join(STORE, 'l10n', locale + '.json')))['listing']


def url(locale):
    folder = LANGUAGES[locale][0]
    return f'{SITE}/{folder}/' if folder else f'{SITE}/'


def e(s):
    return html.escape(s, quote=True)


def page(locale):
    folder, hreflang, app_lang, og_locale, own_name = LANGUAGES[locale]
    t = text(locale)
    L = dict(zip(LABEL_KEYS, LABELS[locale]))
    paras = [p.strip() for p in t['description'].split('\n\n') if p.strip()]
    pitch = ENGLISH_PITCH if locale == 'en-US' else paras[0]
    about = paras[1] if len(paras) > 1 else ''
    bullets = [b.lstrip('•').strip() for p in paras for b in p.split('\n') if b.strip().startswith('•')]
    credit = paras[-1] if not paras[-1].lstrip().startswith('•') else ''
    title = f"Weather Penguin: {t['subtitle']}"
    description = t['promotional_text']

    def feature(b):
        head, sep, rest = b.partition(': ') if ': ' in b else b.partition('：')
        if sep and len(head) <= 40:   # the heading on its own line, so the sentence after it starts with a capital
            return f'<li><strong>{e(head)}</strong> {e(rest[:1].upper() + rest[1:])}</li>'
        return f'<li><strong>{e(b)}</strong></li>'

    alternates = '\n'.join(f'  <link rel="alternate" hreflang="{LANGUAGES[l][1]}" href="{url(l)}">' for l in LANGUAGES)
    alternates += f'\n  <link rel="alternate" hreflang="x-default" href="{SITE}/">'
    others = ''.join(f'<meta property="og:locale:alternate" content="{LANGUAGES[l][3]}">' for l in LANGUAGES if l != locale)
    langs = '\n'.join(
        f'        <li><a href="/{LANGUAGES[l][0]}{"/" if LANGUAGES[l][0] else ""}" hreflang="{LANGUAGES[l][1]}" lang="{LANGUAGES[l][1]}"'
        + (' aria-current="page"' if l == locale else '') + f'>{e(LANGUAGES[l][4])}</a></li>' for l in LANGUAGES)
    ld = json.dumps({
        '@context': 'https://schema.org', '@type': 'MobileApplication', 'name': 'Weather Penguin',
        'description': description, 'operatingSystem': 'iOS, iPadOS, watchOS', 'applicationCategory': 'WeatherApplication',
        'inLanguage': [LANGUAGES[l][1] for l in LANGUAGES], 'url': url(locale), 'downloadUrl': APP_STORE,
        'image': f'{SITE}/img/main_umbrella.png', 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
        'author': {'@type': 'Organization', 'name': 'EEG LLC'},
    }, ensure_ascii=False)
    demo = f'/app/?sample={{s}}&lang={app_lang}'
    samples = ' '.join(f'<a href="{e(demo.format(s=s))}" data-demo aria-controls="demo"{" aria-current=\"true\"" if s == "hot" else ""}>{e(L[k])}</a>'
                       for s, k in (('rainLater', 'rain'), ('cold', 'cold'), ('warm', 'warm'), ('hot', 'hot')))
    return f'''<!doctype html>
<!-- Made by tools/make_site.py from the App Store text (app/ios/store): edit that, not this page. -->
<html lang="{hreflang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(description)}">
  <link rel="canonical" href="{url(locale)}">
{alternates}
  <meta name="theme-color" content="#d7eef5">
  <meta name="color-scheme" content="light">
  <meta name="apple-itunes-app" content="app-id=713690248">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Weather Penguin">
  <meta property="og:url" content="{url(locale)}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(description)}">
  <meta property="og:image" content="{SITE}/img/main_umbrella.png">
  <meta property="og:image:alt" content="Weather Penguin">
  <meta property="og:locale" content="{og_locale}">{others}
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/favicon.png">
  <link rel="stylesheet" href="/site.css">
  <script type="application/ld+json">{ld}</script>
  <script src="/app/config.js" defer></script>
  <script type="module">import {{ startStats }} from '/app/stats.js'; startStats();</script>
  <script type="module" src="/home.js"></script>
</head>
<body>
  <header>
    <h1 class="title">Weather Penguin</h1>
  </header>

  <main>
    <div class="hero">
      <div class="rain" aria-hidden="true"></div>
      <img src="/img/main_umbrella.png" width="650" height="607" alt="" fetchpriority="high">
    </div>

    <section class="band" aria-label="Weather Penguin">
      <div class="band-inner">
        <div class="pitch">
          <p>{e(pitch)}</p>
          <a class="store" href="{APP_STORE}">
            <img src="/img/app-store-badge.svg" width="180" height="60" alt="Download on the App Store">
          </a>
          <p class="free">{e(L['free'])}</p>
        </div>
        <div>
          <div class="phone">
            <iframe src="{e(demo.format(s='hot'))}" title="Weather Penguin" loading="lazy" id="demo"></iframe>
          </div>
          <p class="try">{e(L['try'])} {samples}</p>
        </div>
      </div>
    </section>

    <section class="about">
      <h2>{e(t['subtitle'])}</h2>
      <p class="lead">{e(about)}</p>
      <h2>{e(L['features'])}</h2>
      <ul class="features">
{chr(10).join('        ' + feature(b) for b in bullets)}
      </ul>
      <p class="credit">{e(credit)}</p>
      <h2>{e(L['languages'])}</h2>
      <ul class="languages">
{langs}
      </ul>
    </section>
  </main>

  <footer class="footer">
    <nav aria-label="Site"><a href="/support.html">{e(L['support'])}</a><a href="/privacy.html">{e(L['privacy'])}</a><a href="/terms.html">{e(L['terms'])}</a></nav>
    <p><small>&copy; EEG LLC</small></p>
  </footer>
</body>
</html>
'''


def main():
    for locale in LANGUAGES:
        folder = LANGUAGES[locale][0]
        out = os.path.join(WEB, folder, 'index.html') if folder else os.path.join(WEB, 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w').write(page(locale))
    today = datetime.date.today().isoformat()
    alts = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{LANGUAGES[l][1]}" href="{url(l)}"/>' for l in LANGUAGES)
    alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/"/>'
    urls = [f'  <url>\n    <loc>{url(l)}</loc>\n    <lastmod>{today}</lastmod>{alts}\n  </url>' for l in LANGUAGES]
    urls += [f'  <url>\n    <loc>{SITE}/{p}</loc>\n    <lastmod>{today}</lastmod>\n  </url>' for p in ('support.html', 'privacy.html', 'terms.html')]
    open(os.path.join(WEB, 'sitemap.xml'), 'w').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + '\n'.join(urls) + '\n</urlset>\n')
    # everything may be crawled (the demo in /app/ has its own noindex: it's the app's screens in a frame)
    open(os.path.join(WEB, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')
    print(f'{len(LANGUAGES)} pages, sitemap.xml, robots.txt')


if __name__ == '__main__':
    main()
